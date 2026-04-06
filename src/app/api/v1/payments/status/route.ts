import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";
import {
  buildTossApiUrl,
  createTossBasicAuthorization,
} from "@/lib/payments/toss-api";
import { logError } from "@/lib/server/logger";
import {
  getPaymentByOrderId,
  PaymentDomainError,
  settlePaymentAndCredit,
} from "@/lib/server/payment-service";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type ReconciliationState =
  | "not_attempted"
  | "pending"
  | "settled"
  | "amount_mismatch"
  | "error";

interface TossOrderLookup {
  paymentKey?: string;
  totalAmount: number;
  status?: string;
}

function normalizeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

async function parseJsonSafe(
  response: Response,
): Promise<Record<string, unknown> | null> {
  try {
    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchTossPaymentByOrderId(
  orderId: string,
): Promise<TossOrderLookup | null> {
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

  const payload = await parseJsonSafe(response);
  if (!payload) {
    return null;
  }

  return {
    paymentKey:
      typeof payload.paymentKey === "string" ? payload.paymentKey : undefined,
    totalAmount: normalizeNumber(
      payload.totalAmount || payload.balanceAmount || payload.amount || 0,
    ),
    status: typeof payload.status === "string" ? payload.status : undefined,
  };
}

function parseSearchParams(request: NextRequest): URLSearchParams {
  const rawUrl = request.url || "http://localhost";
  try {
    return new URL(rawUrl).searchParams;
  } catch {
    return new URL(rawUrl, "http://localhost").searchParams;
  }
}

export async function GET(request: NextRequest) {
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`payments:status:${auth.userId}`, 120, 60_000)) {
    return fail(429, "Too many payment status requests");
  }

  const searchParams = parseSearchParams(request);
  const orderId = (searchParams.get("orderId") || "").trim();
  const paymentKeyParam = (searchParams.get("paymentKey") || "").trim();
  const amountRaw = (searchParams.get("amount") || "").trim();
  const amountParam = amountRaw ? Number(amountRaw) : null;

  if (!orderId) {
    return fail(400, "orderId is required");
  }

  if (
    amountParam !== null &&
    (!Number.isFinite(amountParam) || Number(amountParam) <= 0)
  ) {
    return fail(400, "amount must be a positive number");
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
    });
    let payment = await getPaymentByOrderId(admin, orderId);

    if (!payment) {
      return fail(404, "Payment record not found");
    }

    if (payment.user_id !== auth.userId) {
      return fail(403, "Payment does not belong to current user");
    }

    if (amountParam !== null && Number(payment.amount) !== amountParam) {
      return fail(400, "Amount mismatch");
    }

    let providerStatus: string | undefined;
    let reconciliationState: ReconciliationState = "not_attempted";
    let beadCount: number | undefined;
    let alreadyProcessed: boolean | undefined;

    if (payment.status === "pending") {
      const tossPayment = await fetchTossPaymentByOrderId(orderId).catch(
        () => null,
      );
      if (!tossPayment) {
        reconciliationState = "error";
      } else if (tossPayment.status !== "DONE") {
        providerStatus = tossPayment.status;
        reconciliationState = "pending";
      } else if (Number(payment.amount) !== Number(tossPayment.totalAmount)) {
        providerStatus = tossPayment.status;
        reconciliationState = "amount_mismatch";
      } else {
        const paymentKeyToUse =
          paymentKeyParam || payment.payment_key || tossPayment.paymentKey;

        providerStatus = tossPayment.status;
        if (paymentKeyToUse) {
          const settled = await settlePaymentAndCredit(
            admin,
            payment,
            paymentKeyToUse,
          );
          beadCount = settled.beadCount;
          alreadyProcessed = settled.alreadyProcessed;
          reconciliationState = "settled";

          const refreshed = await getPaymentByOrderId(admin, orderId);
          if (refreshed) {
            payment = refreshed;
          }
        } else {
          reconciliationState = "pending";
        }
      }
    }

    return ok({
      orderId: payment.order_id,
      status: payment.status,
      amount: Number(payment.amount),
      beadQuantity: Number(payment.bead_quantity),
      paymentKey: payment.payment_key || paymentKeyParam || null,
      beadCount,
      alreadyProcessed,
      completedAt: payment.completed_at || null,
      providerStatus,
      reconciliationState,
    });
  } catch (error) {
    if (error instanceof PaymentDomainError) {
      if (error.code === "PAYMENT_NOT_FOUND") {
        return fail(404, "Payment record not found");
      }

      if (error.code === "PAYMENT_USER_MISMATCH") {
        return fail(403, "Payment does not belong to current user");
      }

      if (error.code === "PAYMENT_CANCELLED") {
        return fail(409, "Payment is cancelled");
      }

      if (
        error.code === "PAYMENT_KEY_MISMATCH" ||
        error.code === "PAYMENT_INVALID_STATUS_TRANSITION"
      ) {
        return fail(409, "Payment state conflict");
      }

      if (error.code === "PAYMENT_KEY_REQUIRED") {
        return fail(400, "paymentKey is required");
      }
    }

    logError("/api/v1/payments/status", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to fetch payment status");
  }
}
