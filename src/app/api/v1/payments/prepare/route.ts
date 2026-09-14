import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
import {
  buildPaymentFlowHeaders,
  readPaymentFlowIdFromHeaders,
  resolvePaymentFlowId,
} from "@/lib/payments/flow-diagnostics";
import { findBeadPackageById } from "@/lib/payments/packages";
import { trackUserActivityBestEffort } from "@/lib/server/analytics";
import { logError, logInfo } from "@/lib/server/logger";
import {
  createOrderId,
  createPendingPayment,
  findRecentPendingPayment,
} from "@/lib/server/payment-service";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface PreparePaymentRequestBody {
  packageId: string;
}

export async function POST(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  const requestPaymentFlowId = resolvePaymentFlowId({
    candidate: readPaymentFlowIdFromHeaders(request.headers),
    fallbackSeed: requestId,
  });
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/payments/prepare authenticateRequest", error, {
      requestId,
      paymentFlowId: requestPaymentFlowId,
    });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED", undefined, {
      headers: buildPaymentFlowHeaders("prepare", requestPaymentFlowId),
    });
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED", undefined, {
      headers: buildPaymentFlowHeaders("prepare", requestPaymentFlowId),
    });
  }
  const authContext = auth;

  if (!checkRateLimit(`payments:prepare:${authContext.userId}`, 20, 60_000)) {
    return failWithCode(
      429,
      "Too many payment preparation requests",
      "PAYMENTS_PREPARE_RATE_LIMITED",
      undefined,
      {
        headers: buildPaymentFlowHeaders("prepare", requestPaymentFlowId),
      },
    );
  }

  let body: PreparePaymentRequestBody;
  try {
    body = (await request.json()) as PreparePaymentRequestBody;
  } catch (error) {
    return failWithCode(
      400,
      "Invalid JSON body",
      "REQUEST_JSON_INVALID",
      undefined,
      {
        headers: buildPaymentFlowHeaders("prepare", requestPaymentFlowId),
      },
    );
  }

  if (typeof body.packageId !== "string") {
    return failWithCode(
      400,
      "packageId must be a string",
      "PAYMENTS_PACKAGE_ID_TYPE_INVALID",
      undefined,
      {
        headers: buildPaymentFlowHeaders("prepare", requestPaymentFlowId),
      },
    );
  }

  const packageId = body.packageId.trim();
  const selectedPackage = findBeadPackageById(packageId);

  if (!selectedPackage) {
    return failWithCode(
      400,
      "Invalid packageId",
      "PAYMENTS_PACKAGE_ID_INVALID",
      undefined,
      {
        headers: buildPaymentFlowHeaders("prepare", requestPaymentFlowId),
      },
    );
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });
    const existingPending = await findRecentPendingPayment(admin, {
      userId: authContext.userId,
      amount: selectedPackage.price,
      beadQuantity: selectedPackage.quantity,
      lookbackMinutes: 5,
    });

    const orderId = existingPending?.order_id || createOrderId();
    const paymentFlowId = resolvePaymentFlowId({
      orderId,
      candidate: readPaymentFlowIdFromHeaders(request.headers),
      fallbackSeed: requestId,
    });

    if (!existingPending) {
      await createPendingPayment(admin, {
        userId: authContext.userId,
        orderId,
        paymentFlowId,
        amount: selectedPackage.price,
        beadQuantity: selectedPackage.quantity,
      });
    }

    await trackUserActivityBestEffort(
      admin,
      authContext.userId,
      "purchase_prepare",
      {
        order_id: orderId,
        package_id: selectedPackage.id,
        amount: selectedPackage.price,
        quantity: selectedPackage.quantity,
        payment_flow_id: paymentFlowId,
      },
      request,
    );

    logInfo("/api/v1/payments/prepare", {
      requestId,
      userId: authContext.userId,
      orderId,
      paymentFlowId,
      reusedPendingPayment: Boolean(existingPending),
    });

    return ok(
      {
        orderId,
        amount: selectedPackage.price,
        orderName: `곶감 ${selectedPackage.quantity}개`,
        paymentFlowId,
        package: selectedPackage,
      },
      {
        headers: buildPaymentFlowHeaders("prepare", paymentFlowId),
      },
    );
  } catch (error) {
    logError("/api/v1/payments/prepare", error, {
      requestId,
      userId: authContext.userId,
      paymentFlowId: requestPaymentFlowId,
    });
    return failWithCode(
      500,
      "Failed to prepare payment",
      "PAYMENTS_PREPARE_FAILED",
      undefined,
      {
        headers: buildPaymentFlowHeaders("prepare", requestPaymentFlowId),
      },
    );
  }
}
