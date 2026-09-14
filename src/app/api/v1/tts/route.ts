import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
import googleTtsApi from "@/lib/client/api/google-tts";
import { logError } from "@/lib/server/logger";
import {
  DailyQuotaExceededError,
  consumeDailyTtsQuota,
} from "@/lib/server/quota";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface TtsRequestBody {
  text: string;
  language?: string;
  pitch?: number;
}

const LANGUAGE_CODE_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/;

export async function POST(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/tts authenticateRequest", error, { requestId });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (!checkRateLimit(`tts:${authContext.userId}`, 60, 60_000)) {
    return failWithCode(429, "Too many TTS requests", "TTS_RATE_LIMITED");
  }

  let body: TtsRequestBody;
  try {
    body = (await request.json()) as TtsRequestBody;
  } catch (error) {
    return failWithCode(400, "Invalid JSON body", "REQUEST_JSON_INVALID");
  }

  const text = (body.text || "").trim();
  const language = (body.language || "ko").trim() || "ko";
  const pitch = Number(body.pitch ?? 1);

  if (!text) {
    return failWithCode(400, "Text is required", "TTS_TEXT_REQUIRED");
  }

  if (!LANGUAGE_CODE_PATTERN.test(language)) {
    return failWithCode(400, "Invalid language code", "TTS_LANGUAGE_INVALID");
  }

  if (text.length > 5000) {
    return failWithCode(400, "Text is too long", "TTS_TEXT_TOO_LONG");
  }

  if (!Number.isFinite(pitch) || pitch < 0.5 || pitch > 2) {
    return failWithCode(
      400,
      "Pitch must be between 0.5 and 2.0",
      "TTS_PITCH_INVALID",
    );
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });
    const ttsQuota = await consumeDailyTtsQuota(
      admin,
      authContext.userId,
      text.length,
      {
        endpoint: "tts",
        language,
        pitch,
        text_length: text.length,
      },
    );

    const audioDataArray =
      text.length > 190
        ? await googleTtsApi.getAudioArrayWithCache(text, language, pitch)
        : [await googleTtsApi.getAudioWithCache(text, language, pitch)];

    return ok(
      {
        audioDataArray,
        contentType: "audio/mp3",
      },
      {
        headers: {
          "x-quota-tts-used": String(ttsQuota.used),
          "x-quota-tts-remaining": String(ttsQuota.remaining),
        },
      },
    );
  } catch (error) {
    if (
      error instanceof DailyQuotaExceededError &&
      error.code === "DAILY_TTS_CHAR_LIMIT_EXCEEDED"
    ) {
      return failWithCode(
        429,
        "Daily TTS character quota exceeded",
        "TTS_DAILY_QUOTA_EXCEEDED",
      );
    }

    logError("/api/v1/tts", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(
      500,
      "Failed to generate speech audio",
      "TTS_GENERATION_FAILED",
    );
  }
}
