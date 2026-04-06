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
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`tts:${auth.userId}`, 60, 60_000)) {
    return fail(429, "Too many TTS requests");
  }

  let body: TtsRequestBody;
  try {
    body = (await request.json()) as TtsRequestBody;
  } catch (error) {
    return fail(400, "Invalid JSON body");
  }

  const text = (body.text || "").trim();
  const language = (body.language || "ko").trim() || "ko";
  const pitch = Number(body.pitch ?? 1);

  if (!text) {
    return fail(400, "Text is required");
  }

  if (!LANGUAGE_CODE_PATTERN.test(language)) {
    return fail(400, "Invalid language code");
  }

  if (text.length > 5000) {
    return fail(400, "Text is too long");
  }

  if (!Number.isFinite(pitch) || pitch < 0.5 || pitch > 2) {
    return fail(400, "Pitch must be between 0.5 and 2.0");
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
    });
    const ttsQuota = await consumeDailyTtsQuota(
      admin,
      auth.userId,
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
      return fail(429, "Daily TTS character quota exceeded");
    }

    logError("/api/v1/tts", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to generate speech audio");
  }
}
