import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
import { logError } from "@/lib/server/logger";
import { listPaymentsByUser } from "@/lib/server/payment-service";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/payments/history authenticateRequest", error, {
      requestId,
    });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (!checkRateLimit(`payments:history:${authContext.userId}`, 120, 60_000)) {
    return failWithCode(
      429,
      "Too many payment history requests",
      "PAYMENTS_HISTORY_RATE_LIMITED",
    );
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });
    const payments = await listPaymentsByUser(admin, authContext.userId);
    return ok({ payments });
  } catch (error) {
    logError("/api/v1/payments/history", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(
      500,
      "Failed to fetch payment history",
      "PAYMENTS_HISTORY_FETCH_FAILED",
    );
  }
}
