import { NextRequest } from "next/server";

import { randomUUID } from "crypto";

import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_BUCKET = "profiles";
const PROFILE_IMAGE_PREFIX = "/storage/v1/object/public/profiles/";

const PROFILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function getOwnStoragePath(reference: string, userId: string): string | null {
  const markerIndex = reference.indexOf(PROFILE_IMAGE_PREFIX);
  let rawPath = "";
  if (reference.startsWith("profiles:")) {
    rawPath = reference.slice("profiles:".length);
  } else if (markerIndex >= 0) {
    [rawPath] = reference
      .slice(markerIndex + PROFILE_IMAGE_PREFIX.length)
      .split("?");
  }
  let path;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  // The users row is user-editable. Never let its value select another user's
  // object for deletion, even when database policies also restrict access.
  const flatPrefix = `profile_${userId}_`;
  const legacyPrefix = `${userId}/profile_`;
  const ownFlat =
    path.startsWith(flatPrefix) &&
    /^[a-z0-9-]+\.(jpg|png|webp|gif)$/.test(path.slice(flatPrefix.length));
  const ownLegacy =
    path.startsWith(legacyPrefix) &&
    /^[0-9]+\.[a-z0-9]+$/.test(path.slice(legacyPrefix.length));
  return ownFlat || ownLegacy ? path : null;
}

export async function POST(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/profile/image POST authenticateRequest", error, {
      requestId,
    });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (
    !checkRateLimit(`profile:image:upload:${authContext.userId}`, 30, 60_000)
  ) {
    return failWithCode(
      429,
      "Too many profile image upload requests",
      "PROFILE_IMAGE_UPLOAD_RATE_LIMITED",
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return failWithCode(
        400,
        "Image file is required",
        "PROFILE_IMAGE_REQUIRED",
      );
    }

    const ext = PROFILE_EXTENSIONS[file.type];
    if (!ext) {
      return failWithCode(
        400,
        "Only image files are allowed",
        "PROFILE_IMAGE_CONTENT_TYPE_INVALID",
      );
    }

    if (file.size <= 0) {
      return failWithCode(400, "Empty image file", "PROFILE_IMAGE_EMPTY");
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      return failWithCode(
        400,
        "Image file must be 5MB or smaller",
        "PROFILE_IMAGE_SIZE_EXCEEDED",
      );
    }

    const filePath = `profile_${authContext.userId}_${randomUUID()}.${ext}`;
    const userClient = requireUserClient(authContext.accessToken);

    const { error: uploadError } = await userClient.storage
      .from(PROFILE_BUCKET)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: signed, error: signingError } = await userClient.storage
      .from(PROFILE_BUCKET)
      .createSignedUrl(filePath, 3600);

    if (signingError || !signed?.signedUrl) {
      throw signingError || new Error("Failed to sign profile image");
    }

    const imageUrl = signed.signedUrl;
    const { error: updateError } = await userClient
      .from("users")
      .update({
        custom_profile_url: `profiles:${filePath}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authContext.userId);

    if (updateError) {
      throw updateError;
    }

    return ok({
      success: true,
      imageUrl,
    });
  } catch (error) {
    logError("/api/v1/profile/image POST", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(
      500,
      "Failed to upload profile image",
      "PROFILE_IMAGE_UPLOAD_FAILED",
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/profile/image DELETE authenticateRequest", error, {
      requestId,
    });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (
    !checkRateLimit(`profile:image:delete:${authContext.userId}`, 30, 60_000)
  ) {
    return failWithCode(
      429,
      "Too many profile image delete requests",
      "PROFILE_IMAGE_DELETE_RATE_LIMITED",
    );
  }

  try {
    const userClient = requireUserClient(authContext.accessToken);

    const { data: userData, error: userError } = await userClient
      .from("users")
      .select("custom_profile_url")
      .eq("id", authContext.userId)
      .single();

    if (userError) {
      throw userError;
    }

    const existingUrl = userData?.custom_profile_url as string | null;
    const { error: updateError } = await userClient
      .from("users")
      .update({
        custom_profile_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authContext.userId);

    if (updateError) {
      throw updateError;
    }

    if (existingUrl) {
      const storagePath = getOwnStoragePath(existingUrl, authContext.userId);
      if (storagePath) {
        await userClient.storage.from(PROFILE_BUCKET).remove([storagePath]);
      }
    }

    return ok({ success: true });
  } catch (error) {
    logError("/api/v1/profile/image DELETE", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(
      500,
      "Failed to remove profile image",
      "PROFILE_IMAGE_DELETE_FAILED",
    );
  }
}
