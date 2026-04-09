import { NextRequest } from "next/server";

import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import { ensureBeadRow } from "@/lib/server/hodam-repo";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";

export async function GET(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/beads authenticateRequest", error, { requestId });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (!checkRateLimit(`beads:read:${authContext.userId}`, 120, 60_000)) {
    return failWithCode(429, "Too many bead requests", "BEADS_RATE_LIMITED");
  }

  try {
    const userClient = requireUserClient(authContext.accessToken);
    const bead = await ensureBeadRow(userClient, authContext.userId);

    return ok({
      bead: {
        id: bead.id,
        user_id: authContext.userId,
        count: bead.count,
      },
    });
  } catch (error) {
    logError("/api/v1/beads", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(500, "Failed to fetch beads", "BEADS_FETCH_FAILED");
  }
}
