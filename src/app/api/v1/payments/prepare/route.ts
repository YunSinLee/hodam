import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
import { findBeadPackageById } from "@/lib/payments/packages";
import { trackUserActivityBestEffort } from "@/lib/server/analytics";
import { logError } from "@/lib/server/logger";
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
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`payments:prepare:${auth.userId}`, 20, 60_000)) {
    return fail(429, "Too many payment preparation requests");
  }

  let body: PreparePaymentRequestBody;
  try {
    body = (await request.json()) as PreparePaymentRequestBody;
  } catch (error) {
    return fail(400, "Invalid JSON body");
  }

  if (typeof body.packageId !== "string") {
    return fail(400, "packageId must be a string");
  }

  const packageId = body.packageId.trim();
  const selectedPackage = findBeadPackageById(packageId);

  if (!selectedPackage) {
    return fail(400, "Invalid packageId");
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
    });
    const existingPending = await findRecentPendingPayment(admin, {
      userId: auth.userId,
      amount: selectedPackage.price,
      beadQuantity: selectedPackage.quantity,
      lookbackMinutes: 5,
    });

    const orderId = existingPending?.order_id || createOrderId();

    if (!existingPending) {
      await createPendingPayment(admin, {
        userId: auth.userId,
        orderId,
        amount: selectedPackage.price,
        beadQuantity: selectedPackage.quantity,
      });
    }

    await trackUserActivityBestEffort(
      admin,
      auth.userId,
      "purchase_prepare",
      {
        order_id: orderId,
        package_id: selectedPackage.id,
        amount: selectedPackage.price,
        quantity: selectedPackage.quantity,
      },
      request,
    );

    return ok({
      orderId,
      amount: selectedPackage.price,
      orderName: `곶감 ${selectedPackage.quantity}개`,
      package: selectedPackage,
    });
  } catch (error) {
    logError("/api/v1/payments/prepare", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to prepare payment");
  }
}
