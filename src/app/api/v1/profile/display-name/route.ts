import { NextRequest } from "next/server";

import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";

interface Body {
  displayName?: string;
}

export async function POST(request: NextRequest) {
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`profile:display-name:${auth.userId}`, 30, 60_000)) {
    return fail(429, "Too many display name update requests");
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch (error) {
    return fail(400, "Invalid JSON body");
  }

  const rawDisplayName =
    typeof body.displayName === "string" ? body.displayName : "";

  if (/[\r\n\t]/.test(rawDisplayName)) {
    return fail(400, "displayName contains unsupported characters");
  }

  const displayName = rawDisplayName.replace(/\s{2,}/g, " ").trim();

  if (!displayName) {
    return fail(400, "displayName is required");
  }

  if (displayName.length < 2 || displayName.length > 30) {
    return fail(400, "displayName must be between 2 and 30 characters");
  }

  try {
    const userClient = requireUserClient(auth.accessToken);
    const { error } = await userClient
      .from("users")
      .update({
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.userId);

    if (error) {
      throw error;
    }

    return ok({ success: true });
  } catch (error) {
    logError("/api/v1/profile/display-name", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to update display name");
  }
}
