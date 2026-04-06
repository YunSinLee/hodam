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
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`profile:image:upload:${auth.userId}`, 30, 60_000)) {
    return fail(429, "Too many profile image upload requests");
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return fail(400, "Image file is required");
    }

    if (!file.type.startsWith("image/")) {
      return fail(400, "Only image files are allowed");
    }

    if (file.size <= 0) {
      return fail(400, "Empty image file");
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      return fail(400, "Image file must be 5MB or smaller");
    }

    const ext = extractFileExtension(file);
    const filePath = `${auth.userId}/profile_${Date.now()}.${ext}`;
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
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
      .eq("id", auth.userId);

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
      userId: auth.userId,
    });
    return fail(500, "Failed to upload profile image");
  }
}

export async function DELETE(request: NextRequest) {
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`profile:image:delete:${auth.userId}`, 30, 60_000)) {
    return fail(429, "Too many profile image delete requests");
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
    });

    const { data: userData, error: userError } = await admin
      .from("users")
      .select("custom_profile_url")
      .eq("id", auth.userId)
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
      .eq("id", auth.userId);

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
      userId: auth.userId,
    });
    return fail(500, "Failed to remove profile image");
  }
}
