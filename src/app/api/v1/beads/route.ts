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
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`beads:read:${auth.userId}`, 120, 60_000)) {
    return fail(429, "Too many bead requests");
  }

  try {
    const userClient = requireUserClient(auth.accessToken);
    const bead = await ensureBeadRow(userClient, auth.userId);

    return ok({
      bead: {
        id: bead.id,
        user_id: auth.userId,
        count: bead.count,
      },
    });
  } catch (error) {
    logError("/api/v1/beads", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to fetch beads");
  }
}
