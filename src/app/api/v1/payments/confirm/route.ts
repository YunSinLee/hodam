import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
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
  markPaymentFailed,
  PaymentDomainError,
  settlePaymentAndCredit,
} from "@/lib/server/payment-service";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface ConfirmPaymentRequestBody {
  paymentKey: string;
  orderId: string;
  amount: number;
}

function isAlreadyProcessedPaymentError(code: string | undefined): boolean {
  if (!code) return false;
  const normalized = code.trim().toUpperCase();
  return [
    "ALREADY_PROCESSED_PAYMENT",
    "ALREADY_COMPLETED_PAYMENT",
    "ALREADY_DONE_PAYMENT",
  ].includes(normalized);
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

export async function POST(request: NextRequest) {
  const {
    failWithCode,
    ok: okWithRequestId,
    requestId,
  } = createApiRequestContext(request);
  const incomingPaymentFlowId = readPaymentFlowIdFromHeaders(request.headers);
  const requestPaymentFlowId = resolvePaymentFlowId({
    candidate: incomingPaymentFlowId,
    fallbackSeed: requestId,
  });

  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/payments/confirm authenticateRequest", error, {
      requestId,
      paymentFlowId: requestPaymentFlowId,
    });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED", undefined, {
      headers: buildPaymentFlowHeaders("confirm", requestPaymentFlowId),
    });
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED", undefined, {
      headers: buildPaymentFlowHeaders("confirm", requestPaymentFlowId),
    });
  }
  const authContext = auth;

  if (!checkRateLimit(`payments:confirm:${authContext.userId}`, 20, 60_000)) {
    return failWithCode(
      429,
      "Too many payment confirmation requests",
      "PAYMENTS_CONFIRM_RATE_LIMITED",
      undefined,
      {
        headers: buildPaymentFlowHeaders("confirm", requestPaymentFlowId),
      },
    );
  }

  let body: ConfirmPaymentRequestBody;
  try {
    body = (await request.json()) as ConfirmPaymentRequestBody;
  } catch (error) {
    return failWithCode(
      400,
      "Invalid JSON body",
      "REQUEST_JSON_INVALID",
      undefined,
      {
        headers: buildPaymentFlowHeaders("confirm", requestPaymentFlowId),
      },
    );
  }

  const paymentKey = (body.paymentKey || "").trim();
  const orderId = (body.orderId || "").trim();
  const amount = Number(body.amount);
  const paymentFlowId = resolvePaymentFlowId({
    orderId,
    candidate: incomingPaymentFlowId,
    fallbackSeed: requestId,
  });

  if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
    return failWithCode(
      400,
      "paymentKey, orderId, amount are required",
      "PAYMENTS_CONFIRM_INPUT_INVALID",
      undefined,
      {
        headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
      },
    );
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });
    const payment = await getPaymentByOrderId(admin, orderId);

    if (!payment) {
      return failWithCode(
        404,
        "Payment record not found",
        "PAYMENT_NOT_FOUND",
        undefined,
        {
          headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
        },
      );
    }

    if (payment.user_id !== authContext.userId) {
      return failWithCode(
        403,
        "Payment does not belong to current user",
        "PAYMENT_USER_MISMATCH",
        undefined,
        {
          headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
        },
      );
    }

    if (Number(payment.amount) !== amount) {
      return failWithCode(
        400,
        "Amount mismatch",
        "PAYMENT_AMOUNT_MISMATCH",
        undefined,
        {
          headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
        },
      );
    }

    if (payment.status === "cancelled") {
      return failWithCode(
        409,
        "Payment is cancelled",
        "PAYMENT_CANCELLED",
        undefined,
        {
          headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
        },
      );
    }

    if (payment.status === "completed") {
      const settled = await settlePaymentAndCredit(admin, payment, paymentKey);
      await trackUserActivityBestEffort(
        admin,
        authContext.userId,
        "purchase_success",
        {
          order_id: orderId,
          amount,
          bead_count: settled.beadCount,
          already_processed: true,
          source: "already_completed",
          payment_flow_id: paymentFlowId,
        },
        request,
      );

      logInfo("/api/v1/payments/confirm", {
        requestId,
        userId: authContext.userId,
        orderId,
        paymentFlowId,
        outcome: "already_completed",
        alreadyProcessed: true,
      });

      return okWithRequestId(
        {
          success: true,
          orderId,
          paymentKey,
          amount,
          beadCount: settled.beadCount,
          alreadyProcessed: true,
          paymentFlowId,
          paymentStatus: "DONE",
          approvedAt: payment.completed_at || null,
        },
        {
          headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
        },
      );
    }

    const secretKey =
      getOptionalEnv("TOSS_PAYMENTS_SECRET_KEY") ||
      getRequiredEnv("TOSS_PAYMENTS_SECRET_KEY");

    const tossResponse = await fetch(buildTossApiUrl("/payments/confirm"), {
      method: "POST",
      headers: {
        Authorization: createTossBasicAuthorization(secretKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });

    const tossPayload = await parseJsonSafe(tossResponse);
    const tossCode =
      typeof tossPayload?.code === "string" ? tossPayload.code : undefined;
    const tossMessage =
      typeof tossPayload?.message === "string"
        ? tossPayload.message
        : undefined;

    if (!tossResponse.ok) {
      if (isAlreadyProcessedPaymentError(tossCode)) {
        const refreshed = await getPaymentByOrderId(admin, orderId);
        if (refreshed?.status === "completed") {
          const settled = await settlePaymentAndCredit(
            admin,
            refreshed,
            paymentKey,
          );

          logInfo("/api/v1/payments/confirm", {
            requestId,
            userId: authContext.userId,
            orderId,
            paymentFlowId,
            outcome: "provider_already_processed",
            alreadyProcessed: true,
          });

          return okWithRequestId(
            {
              success: true,
              orderId,
              paymentKey,
              amount,
              beadCount: settled.beadCount,
              alreadyProcessed: true,
              paymentFlowId,
              paymentStatus: "DONE",
              approvedAt: refreshed.completed_at || null,
            },
            {
              headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
            },
          );
        }
      }

      if (tossResponse.status >= 500) {
        return failWithCode(
          502,
          "Payment provider temporary failure",
          "PAYMENTS_PROVIDER_TEMP_FAILURE",
          tossCode ? { code: tossCode } : undefined,
          {
            headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
          },
        );
      }

      await markPaymentFailed(admin, orderId);
      return failWithCode(
        400,
        tossMessage || "Payment confirmation failed",
        "PAYMENTS_CONFIRM_FAILED",
        tossCode ? { code: tossCode } : undefined,
        {
          headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
        },
      );
    }

    const settled = await settlePaymentAndCredit(admin, payment, paymentKey);
    await trackUserActivityBestEffort(
      admin,
      authContext.userId,
      "purchase_success",
      {
        order_id: orderId,
        amount,
        bead_count: settled.beadCount,
        already_processed: settled.alreadyProcessed,
        payment_flow_id: paymentFlowId,
      },
      request,
    );

    logInfo("/api/v1/payments/confirm", {
      requestId,
      userId: authContext.userId,
      orderId,
      paymentFlowId,
      outcome: "confirmed",
      alreadyProcessed: settled.alreadyProcessed,
    });

    return okWithRequestId(
      {
        success: true,
        orderId,
        paymentKey,
        amount,
        beadCount: settled.beadCount,
        alreadyProcessed: settled.alreadyProcessed,
        paymentFlowId,
        paymentStatus: tossPayload?.status || "DONE",
        approvedAt: tossPayload?.approvedAt || null,
      },
      {
        headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
      },
    );
  } catch (error) {
    if (error instanceof PaymentDomainError) {
      if (error.code === "PAYMENT_NOT_FOUND") {
        return failWithCode(
          404,
          "Payment record not found",
          "PAYMENT_NOT_FOUND",
          undefined,
          {
            headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
          },
        );
      }

      if (error.code === "PAYMENT_USER_MISMATCH") {
        return failWithCode(
          403,
          "Payment does not belong to current user",
          "PAYMENT_USER_MISMATCH",
          undefined,
          {
            headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
          },
        );
      }

      if (error.code === "PAYMENT_CANCELLED") {
        return failWithCode(
          409,
          "Payment is cancelled",
          "PAYMENT_CANCELLED",
          undefined,
          {
            headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
          },
        );
      }

      if (
        error.code === "PAYMENT_KEY_MISMATCH" ||
        error.code === "PAYMENT_INVALID_STATUS_TRANSITION"
      ) {
        return failWithCode(
          409,
          "Payment state conflict",
          "PAYMENT_STATE_CONFLICT",
          undefined,
          {
            headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
          },
        );
      }

      if (error.code === "PAYMENT_KEY_REQUIRED") {
        return failWithCode(
          400,
          "paymentKey is required",
          "PAYMENT_KEY_REQUIRED",
          undefined,
          {
            headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
          },
        );
      }
    }

    logError("/api/v1/payments/confirm", error, {
      requestId,
      userId: authContext.userId,
      paymentFlowId,
    });
    return failWithCode(
      500,
      "Failed to confirm payment",
      "PAYMENTS_CONFIRM_FAILED",
      undefined,
      {
        headers: buildPaymentFlowHeaders("confirm", paymentFlowId),
      },
    );
  }
}
