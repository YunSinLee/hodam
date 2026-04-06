import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";
import {
  buildTossApiUrl,
  createTossBasicAuthorization,
} from "@/lib/payments/toss-api";
import { trackUserActivityBestEffort } from "@/lib/server/analytics";
import { logError } from "@/lib/server/logger";
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
    fail: failWithRequestId,
    ok: okWithRequestId,
    requestId,
  } = createApiRequestContext(request);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return failWithRequestId(401, "Unauthorized");
  }

  if (!checkRateLimit(`payments:confirm:${auth.userId}`, 20, 60_000)) {
    return failWithRequestId(429, "Too many payment confirmation requests");
  }

  let body: ConfirmPaymentRequestBody;
  try {
    body = (await request.json()) as ConfirmPaymentRequestBody;
  } catch (error) {
    return failWithRequestId(400, "Invalid JSON body");
  }

  const paymentKey = (body.paymentKey || "").trim();
  const orderId = (body.orderId || "").trim();
  const amount = Number(body.amount);

  if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
    return failWithRequestId(400, "paymentKey, orderId, amount are required");
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
    });
    const payment = await getPaymentByOrderId(admin, orderId);

    if (!payment) {
      return failWithRequestId(404, "Payment record not found");
    }

    if (payment.user_id !== auth.userId) {
      return failWithRequestId(403, "Payment does not belong to current user");
    }

    if (Number(payment.amount) !== amount) {
      return failWithRequestId(400, "Amount mismatch");
    }

    if (payment.status === "cancelled") {
      return failWithRequestId(409, "Payment is cancelled");
    }

    if (payment.status === "completed") {
      const settled = await settlePaymentAndCredit(admin, payment, paymentKey);
      await trackUserActivityBestEffort(
        admin,
        auth.userId,
        "purchase_success",
        {
          order_id: orderId,
          amount,
          bead_count: settled.beadCount,
          already_processed: true,
          source: "already_completed",
        },
        request,
      );

      return okWithRequestId({
        success: true,
        orderId,
        paymentKey,
        amount,
        beadCount: settled.beadCount,
        alreadyProcessed: true,
        paymentStatus: "DONE",
        approvedAt: payment.completed_at || null,
      });
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

          return okWithRequestId({
            success: true,
            orderId,
            paymentKey,
            amount,
            beadCount: settled.beadCount,
            alreadyProcessed: true,
            paymentStatus: "DONE",
            approvedAt: refreshed.completed_at || null,
          });
        }
      }

      if (tossResponse.status >= 500) {
        return failWithRequestId(502, "Payment provider temporary failure", {
          code: tossCode || "TOSS_PROVIDER_5XX",
        });
      }

      await markPaymentFailed(admin, orderId);
      return failWithRequestId(
        400,
        tossMessage || "Payment confirmation failed",
        {
          code: tossCode,
        },
      );
    }

    const settled = await settlePaymentAndCredit(admin, payment, paymentKey);
    await trackUserActivityBestEffort(
      admin,
      auth.userId,
      "purchase_success",
      {
        order_id: orderId,
        amount,
        bead_count: settled.beadCount,
        already_processed: settled.alreadyProcessed,
      },
      request,
    );

    return okWithRequestId({
      success: true,
      orderId,
      paymentKey,
      amount,
      beadCount: settled.beadCount,
      alreadyProcessed: settled.alreadyProcessed,
      paymentStatus: tossPayload?.status || "DONE",
      approvedAt: tossPayload?.approvedAt || null,
    });
  } catch (error) {
    if (error instanceof PaymentDomainError) {
      if (error.code === "PAYMENT_NOT_FOUND") {
        return failWithRequestId(404, "Payment record not found");
      }

      if (error.code === "PAYMENT_USER_MISMATCH") {
        return failWithRequestId(
          403,
          "Payment does not belong to current user",
        );
      }

      if (error.code === "PAYMENT_CANCELLED") {
        return failWithRequestId(409, "Payment is cancelled");
      }

      if (
        error.code === "PAYMENT_KEY_MISMATCH" ||
        error.code === "PAYMENT_INVALID_STATUS_TRANSITION"
      ) {
        return failWithRequestId(409, "Payment state conflict");
      }

      if (error.code === "PAYMENT_KEY_REQUIRED") {
        return failWithRequestId(400, "paymentKey is required");
      }
    }

    logError("/api/v1/payments/confirm", error, {
      requestId,
      userId: auth.userId,
    });
    return failWithRequestId(500, "Failed to confirm payment");
  }
}
