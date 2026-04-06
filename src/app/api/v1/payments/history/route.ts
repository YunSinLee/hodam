import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
import { logError } from "@/lib/server/logger";
import { listPaymentsByUser } from "@/lib/server/payment-service";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`payments:history:${auth.userId}`, 120, 60_000)) {
    return fail(429, "Too many payment history requests");
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
    });
    const payments = await listPaymentsByUser(admin, auth.userId);
    return ok({ payments });
  } catch (error) {
    logError("/api/v1/payments/history", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to fetch payment history");
  }
}
