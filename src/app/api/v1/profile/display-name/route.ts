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
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/profile/display-name authenticateRequest", error, {
      requestId,
    });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (
    !checkRateLimit(`profile:display-name:${authContext.userId}`, 30, 60_000)
  ) {
    return failWithCode(
      429,
      "Too many display name update requests",
      "PROFILE_DISPLAY_NAME_RATE_LIMITED",
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch (error) {
    return failWithCode(400, "Invalid JSON body", "REQUEST_JSON_INVALID");
  }

  const rawDisplayName =
    typeof body.displayName === "string" ? body.displayName : "";

  if (/[\r\n\t]/.test(rawDisplayName)) {
    return failWithCode(
      400,
      "displayName contains unsupported characters",
      "PROFILE_DISPLAY_NAME_UNSUPPORTED_CHARACTERS",
    );
  }

  const displayName = rawDisplayName.replace(/\s{2,}/g, " ").trim();

  if (!displayName) {
    return failWithCode(
      400,
      "displayName is required",
      "PROFILE_DISPLAY_NAME_REQUIRED",
    );
  }

  if (displayName.length < 2 || displayName.length > 30) {
    return failWithCode(
      400,
      "displayName must be between 2 and 30 characters",
      "PROFILE_DISPLAY_NAME_LENGTH_INVALID",
    );
  }

  try {
    const userClient = requireUserClient(authContext.accessToken);
    const { error } = await userClient
      .from("users")
      .update({
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authContext.userId);

    if (error) {
      throw error;
    }

    return ok({ success: true });
  } catch (error) {
    logError("/api/v1/profile/display-name", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(
      500,
      "Failed to update display name",
      "PROFILE_DISPLAY_NAME_UPDATE_FAILED",
    );
  }
}
