import { NextRequest } from "next/server";

import { createHmac, timingSafeEqual } from "crypto";

import { getOptionalEnv, getRequiredEnv } from "@/lib/env";
import {
  buildPaymentFlowHeaders,
  readPaymentFlowIdFromHeaders,
  resolvePaymentFlowId,
} from "@/lib/payments/flow-diagnostics";
import {
  buildTossApiUrl,
  createTossBasicAuthorization,
} from "@/lib/payments/toss-api";
import { trackUserActivityBestEffort } from "@/lib/server/analytics";
import { logError, logInfo } from "@/lib/server/logger";
import {
  getPaymentByOrderId,
  PaymentDomainError,
  registerWebhookTransmission,
  settlePaymentAndCredit,
} from "@/lib/server/payment-service";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const processedTransmissionIds = new Map<string, number>();
const TRANSMISSION_TTL_MS = 1000 * 60 * 60 * 24;
const rawMaxTransmissionCacheSize = Number(
  getOptionalEnv("HODAM_WEBHOOK_MAX_TRANSMISSION_CACHE_SIZE") || 10_000,
);
const MAX_TRANSMISSION_CACHE_SIZE =
  Number.isFinite(rawMaxTransmissionCacheSize) &&
  rawMaxTransmissionCacheSize > 0
    ? rawMaxTransmissionCacheSize
    : 10_000;

interface TossWebhookTransmission {
  id: string;
  time: string;
  retriedCount: number;
}

interface TossWebhookPaymentPayload {
  eventType: string;
  orderId: string;
  paymentKey?: string;
  amount: number;
  status?: string;
  secret?: string;
}

type SignatureEncoding = "hex" | "base64";

function normalizeNumber(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === "string") {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parseTransmissionHeaders(
  request: NextRequest,
): TossWebhookTransmission | null {
  const id =
    request.headers.get("tosspayments-webhook-transmission-id")?.trim() || "";
  const time =
    request.headers.get("tosspayments-webhook-transmission-time")?.trim() || "";
  const retriedCountRaw =
    request.headers
      .get("tosspayments-webhook-transmission-retried-count")
      ?.trim() || "0";
  const retriedCount = Number(retriedCountRaw);

  if (!id || !time || !Number.isFinite(retriedCount) || retriedCount < 0) {
    return null;
  }

  if (Number.isNaN(Date.parse(time))) {
    return null;
  }

  return {
    id,
    time,
    retriedCount,
  };
}

function isDuplicateTransmission(transmissionId: string): boolean {
  const now = Date.now();
  Array.from(processedTransmissionIds.entries()).forEach(([key, savedAt]) => {
    if (now - savedAt > TRANSMISSION_TTL_MS) {
      processedTransmissionIds.delete(key);
    }
  });

  if (processedTransmissionIds.has(transmissionId)) {
    return true;
  }

  processedTransmissionIds.set(transmissionId, now);
  const overflow = processedTransmissionIds.size - MAX_TRANSMISSION_CACHE_SIZE;
  if (overflow > 0) {
    Array.from(processedTransmissionIds.keys())
      .slice(0, overflow)
      .forEach(key => {
        processedTransmissionIds.delete(key);
      });
  }
  return false;
}

function parseSignatureEncoding(raw: string | undefined): SignatureEncoding {
  const normalized = (raw || "hex").trim().toLowerCase();
  if (normalized === "base64") return "base64";
  return "hex";
}

function secureEquals(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}

function verifyWebhookHmacSignature(
  request: NextRequest,
  rawBody: string,
): { ok: boolean; status: number; message?: string } {
  const hmacSecret = getOptionalEnv("TOSS_PAYMENTS_WEBHOOK_HMAC_SECRET");
  if (!hmacSecret) {
    return { ok: true, status: 200 };
  }

  const signatureHeader =
    getOptionalEnv("TOSS_PAYMENTS_WEBHOOK_SIGNATURE_HEADER") ||
    "x-toss-signature";
  const signaturePrefix =
    getOptionalEnv("TOSS_PAYMENTS_WEBHOOK_SIGNATURE_PREFIX") || "";
  const signatureEncoding = parseSignatureEncoding(
    getOptionalEnv("TOSS_PAYMENTS_WEBHOOK_SIGNATURE_ENCODING"),
  );

  const incomingRaw = request.headers.get(signatureHeader)?.trim() || "";
  if (!incomingRaw) {
    return { ok: false, status: 401, message: "Missing webhook signature" };
  }

  let incoming = incomingRaw;
  if (signaturePrefix.length > 0) {
    if (!incomingRaw.startsWith(signaturePrefix)) {
      return { ok: false, status: 401, message: "Invalid webhook signature" };
    }
    incoming = incomingRaw.slice(signaturePrefix.length);
  }

  if (!incoming) {
    return { ok: false, status: 401, message: "Invalid webhook signature" };
  }

  const expected = createHmac("sha256", hmacSecret)
    .update(rawBody)
    .digest(signatureEncoding);

  if (!secureEquals(incoming, expected)) {
    return { ok: false, status: 401, message: "Invalid webhook signature" };
  }

  return { ok: true, status: 200 };
}

async function readWebhookPayload(
  request: NextRequest,
): Promise<{ rawBody: string; payload: Record<string, unknown> | null }> {
  try {
    if (typeof request.text === "function") {
      const rawBody = await request.text();
      const parsed = JSON.parse(rawBody) as unknown;
      if (!parsed || typeof parsed !== "object") {
        return { rawBody, payload: null };
      }
      return {
        rawBody,
        payload: parsed as Record<string, unknown>,
      };
    }

    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { rawBody: "", payload: null };
    }
    return {
      rawBody: JSON.stringify(parsed),
      payload: parsed as Record<string, unknown>,
    };
  } catch {
    return { rawBody: "", payload: null };
  }
}

function extractWebhookPaymentPayload(
  payload: Record<string, unknown>,
): TossWebhookPaymentPayload | null {
  const eventType =
    (typeof payload.eventType === "string" && payload.eventType) ||
    "PAYMENT_STATUS_CHANGED";

  if (payload.data && typeof payload.data === "object") {
    const data = payload.data as Record<string, unknown>;
    const orderId = typeof data.orderId === "string" ? data.orderId : "";

    if (!orderId) {
      return null;
    }

    let secret: string | undefined;
    if (typeof data.secret === "string") {
      secret = data.secret;
    } else if (typeof payload.secret === "string") {
      secret = payload.secret;
    }

    return {
      eventType,
      orderId,
      paymentKey:
        typeof data.paymentKey === "string" ? data.paymentKey : undefined,
      amount: normalizeNumber(data.totalAmount || data.balanceAmount || 0),
      status: typeof data.status === "string" ? data.status : undefined,
      secret,
    };
  }

  const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
  if (!orderId) {
    return null;
  }

  return {
    eventType,
    orderId,
    paymentKey:
      typeof payload.paymentKey === "string" ? payload.paymentKey : undefined,
    amount: normalizeNumber(payload.totalAmount || payload.amount || 0),
    status: typeof payload.status === "string" ? payload.status : undefined,
    secret: typeof payload.secret === "string" ? payload.secret : undefined,
  };
}

async function fetchTossPaymentByOrderId(orderId: string) {
  const secretKey =
    getOptionalEnv("TOSS_PAYMENTS_SECRET_KEY") ||
    getRequiredEnv("TOSS_PAYMENTS_SECRET_KEY");

  const response = await fetch(
    buildTossApiUrl(`/payments/orders/${encodeURIComponent(orderId)}`),
    {
      method: "GET",
      headers: {
        Authorization: createTossBasicAuthorization(secretKey),
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return {
    paymentKey:
      typeof payload.paymentKey === "string" ? payload.paymentKey : undefined,
    totalAmount: normalizeNumber(
      payload.totalAmount || payload.balanceAmount || payload.amount || 0,
    ),
    status: typeof payload.status === "string" ? payload.status : undefined,
    secret: typeof payload.secret === "string" ? payload.secret : undefined,
  };
}

export async function POST(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  const incomingPaymentFlowId = readPaymentFlowIdFromHeaders(request.headers);
  const requestPaymentFlowId = resolvePaymentFlowId({
    candidate: incomingPaymentFlowId,
    fallbackSeed: requestId,
  });
  const webhookSecret = getOptionalEnv("TOSS_PAYMENTS_WEBHOOK_SECRET");
  if (webhookSecret) {
    const incomingSecret = request.headers.get("x-webhook-secret")?.trim();
    if (!incomingSecret || incomingSecret !== webhookSecret) {
      return failWithCode(
        401,
        "Invalid webhook secret",
        "WEBHOOK_SECRET_INVALID",
        undefined,
        {
          headers: buildPaymentFlowHeaders("webhook", requestPaymentFlowId),
        },
      );
    }
  }

  const transmission = parseTransmissionHeaders(request);
  if (!transmission) {
    return failWithCode(
      400,
      "Invalid webhook transmission headers",
      "WEBHOOK_TRANSMISSION_HEADERS_INVALID",
      undefined,
      {
        headers: buildPaymentFlowHeaders("webhook", requestPaymentFlowId),
      },
    );
  }
  const transmissionPaymentFlowId = resolvePaymentFlowId({
    candidate: incomingPaymentFlowId,
    fallbackSeed: transmission.id || requestId,
  });

  const { rawBody, payload: body } = await readWebhookPayload(request);
  if (!body) {
    return failWithCode(
      400,
      "Invalid webhook payload",
      "WEBHOOK_PAYLOAD_INVALID",
      undefined,
      {
        headers: buildPaymentFlowHeaders("webhook", transmissionPaymentFlowId),
      },
    );
  }

  const hmacVerification = verifyWebhookHmacSignature(request, rawBody);
  if (!hmacVerification.ok) {
    return failWithCode(
      hmacVerification.status,
      hmacVerification.message || "Invalid webhook signature",
      "WEBHOOK_SIGNATURE_INVALID",
      undefined,
      {
        headers: buildPaymentFlowHeaders("webhook", transmissionPaymentFlowId),
      },
    );
  }

  if (isDuplicateTransmission(transmission.id)) {
    logInfo("/api/v1/payments/webhook", {
      requestId,
      transmissionId: transmission.id,
      paymentFlowId: transmissionPaymentFlowId,
      ignored: true,
      reason: "duplicate_event_cache",
    });
    return ok(
      { received: true, ignored: true, reason: "duplicate_event" },
      {
        headers: buildPaymentFlowHeaders("webhook", transmissionPaymentFlowId),
      },
    );
  }

  const paymentPayload = extractWebhookPaymentPayload(body);
  const paymentFlowId = resolvePaymentFlowId({
    orderId: paymentPayload?.orderId,
    candidate: incomingPaymentFlowId,
    fallbackSeed: transmission.id || requestId,
  });
  if (!paymentPayload) {
    return ok(
      { received: true, ignored: true },
      {
        headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
      },
    );
  }

  if (
    paymentPayload.eventType === "PAYMENT_STATUS_CHANGED" &&
    paymentPayload.status &&
    paymentPayload.status !== "DONE"
  ) {
    return ok(
      { received: true, ignored: true, reason: "status_not_done" },
      {
        headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
      },
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const registered = await registerWebhookTransmission(admin, {
      transmissionId: transmission.id,
      orderId: paymentPayload.orderId,
      eventType: paymentPayload.eventType,
      transmissionTime: transmission.time,
      retriedCount: transmission.retriedCount,
    });
    if (!registered) {
      return ok(
        { received: true, ignored: true, reason: "duplicate_event" },
        {
          headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
        },
      );
    }

    const payment = await getPaymentByOrderId(admin, paymentPayload.orderId);

    if (!payment) {
      return ok(
        { received: true, ignored: true, reason: "order_not_found" },
        {
          headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
        },
      );
    }

    if (payment.status === "cancelled") {
      return ok(
        {
          received: true,
          ignored: true,
          reason: "payment_cancelled",
        },
        {
          headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
        },
      );
    }

    const requiresTossLookup =
      (!paymentPayload.paymentKey && !payment.payment_key) ||
      paymentPayload.amount <= 0 ||
      paymentPayload.eventType === "DEPOSIT_CALLBACK";

    const tossPayment = requiresTossLookup
      ? await fetchTossPaymentByOrderId(paymentPayload.orderId)
      : null;

    const paymentKeyToUse =
      paymentPayload.paymentKey ||
      tossPayment?.paymentKey ||
      payment.payment_key;
    if (!paymentKeyToUse) {
      return ok(
        {
          received: true,
          ignored: true,
          reason: "payment_key_missing",
        },
        {
          headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
        },
      );
    }

    const amountToCheck =
      paymentPayload.amount > 0
        ? paymentPayload.amount
        : tossPayment?.totalAmount ?? 0;
    if (Number(payment.amount) !== Number(amountToCheck)) {
      return ok(
        {
          received: true,
          ignored: true,
          reason: "amount_mismatch",
        },
        {
          headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
        },
      );
    }

    if (
      paymentPayload.eventType === "DEPOSIT_CALLBACK" &&
      paymentPayload.secret &&
      tossPayment?.secret &&
      paymentPayload.secret !== tossPayment.secret
    ) {
      return failWithCode(
        401,
        "Invalid webhook secret payload",
        "WEBHOOK_SECRET_PAYLOAD_INVALID",
        undefined,
        {
          headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
        },
      );
    }

    const settled = await settlePaymentAndCredit(
      admin,
      payment,
      paymentKeyToUse,
    );
    await trackUserActivityBestEffort(
      admin,
      payment.user_id,
      "purchase_webhook_settled",
      {
        order_id: paymentPayload.orderId,
        amount: amountToCheck,
        already_processed: settled.alreadyProcessed,
        transmission_id: transmission.id,
        transmission_retried_count: transmission.retriedCount,
        payment_flow_id: paymentFlowId,
      },
      request,
    );

    logInfo("/api/v1/payments/webhook", {
      requestId,
      orderId: paymentPayload.orderId,
      transmissionId: transmission.id,
      paymentFlowId,
      settled: true,
      alreadyProcessed: settled.alreadyProcessed,
    });

    return ok(
      {
        received: true,
        settled: true,
        alreadyProcessed: settled.alreadyProcessed,
      },
      {
        headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
      },
    );
  } catch (error) {
    if (error instanceof PaymentDomainError) {
      if (error.code === "PAYMENT_CANCELLED") {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "payment_cancelled",
          },
          {
            headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
          },
        );
      }

      if (
        error.code === "PAYMENT_KEY_MISMATCH" ||
        error.code === "PAYMENT_INVALID_STATUS_TRANSITION"
      ) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "payment_state_conflict",
          },
          {
            headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
          },
        );
      }

      if (error.code === "PAYMENT_KEY_REQUIRED") {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "payment_key_missing",
          },
          {
            headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
          },
        );
      }
    }

    logError("/api/v1/payments/webhook", error, {
      requestId,
      paymentFlowId,
    });
    return failWithCode(
      500,
      "Failed to process webhook",
      "WEBHOOK_PROCESS_FAILED",
      undefined,
      {
        headers: buildPaymentFlowHeaders("webhook", paymentFlowId),
      },
    );
  }
}
