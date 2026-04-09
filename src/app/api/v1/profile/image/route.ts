import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_BUCKET = "profiles";
const PROFILE_IMAGE_PREFIX = "/storage/v1/object/public/profiles/";

function extractFileExtension(file: File): string {
  const namePart = file.name.split(".").pop()?.trim().toLowerCase();
  if (namePart) return namePart;

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "bin";
}

function getStoragePathFromPublicUrl(publicUrl: string): string | null {
  const markerIndex = publicUrl.indexOf(PROFILE_IMAGE_PREFIX);
  if (markerIndex < 0) return null;

  const rawPath = publicUrl.slice(markerIndex + PROFILE_IMAGE_PREFIX.length);
  const [pathWithoutQuery] = rawPath.split("?");
  if (!pathWithoutQuery) return null;

  try {
    return decodeURIComponent(pathWithoutQuery);
  } catch {
    return pathWithoutQuery;
  }
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

    if (!file.type.startsWith("image/")) {
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

    const ext = extractFileExtension(file);
    const filePath = `${authContext.userId}/profile_${Date.now()}.${ext}`;
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });

    const { error: uploadError } = await admin.storage
      .from(PROFILE_BUCKET)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = admin.storage
      .from(PROFILE_BUCKET)
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;
    const { error: updateError } = await admin
      .from("users")
      .update({
        custom_profile_url: imageUrl,
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
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });

    const { data: userData, error: userError } = await admin
      .from("users")
      .select("custom_profile_url")
      .eq("id", authContext.userId)
      .single();

    if (userError) {
      throw userError;
    }

    const existingUrl = userData?.custom_profile_url as string | null;
    const { error: updateError } = await admin
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
      const storagePath = getStoragePathFromPublicUrl(existingUrl);
      if (storagePath) {
        await admin.storage.from(PROFILE_BUCKET).remove([storagePath]);
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
