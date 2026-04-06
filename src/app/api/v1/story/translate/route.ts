import { NextRequest } from "next/server";

import { randomUUID } from "crypto";

import {
  AiServiceConfigurationError,
  translateKoreanParagraphs,
} from "@/lib/ai/story-service";
import { authenticateRequest } from "@/lib/auth/request-auth";
import { trackUserActivityBestEffort } from "@/lib/server/analytics";
import {
  creditBeads,
  debitBeads,
  ensureBeadRow,
  getMessagesForThread,
  getThreadForUser,
  updateMessageTranslations,
} from "@/lib/server/hodam-repo";
import { logError } from "@/lib/server/logger";
import {
  DailyQuotaExceededError,
  consumeDailyAiQuota,
} from "@/lib/server/quota";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface TranslateStoryRequestBody {
  threadId: number;
}

export async function POST(request: NextRequest) {
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`story:translate:${auth.userId}`, 15, 60_000)) {
    return fail(429, "Too many translation requests");
  }

  let body: TranslateStoryRequestBody;
  try {
    body = (await request.json()) as TranslateStoryRequestBody;
  } catch (error) {
    return fail(400, "Invalid JSON body");
  }

  const threadId = Number(body.threadId);
  if (!Number.isFinite(threadId) || threadId <= 0) {
    return fail(400, "Valid threadId is required");
  }

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let debitedCost = 0;
  try {
    admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
    });
    await getThreadForUser(admin, threadId, auth.userId);
    await trackUserActivityBestEffort(
      admin,
      auth.userId,
      "translation_click",
      { thread_id: threadId },
      request,
    );

    const messages = await getMessagesForThread(admin, threadId);

    const korean = messages
      .filter(item => !item.message_en)
      .map(item =>
        typeof item.message === "string" ? item.message.trim() : "",
      )
      .filter(Boolean);

    if (korean.length === 0) {
      const bead = await ensureBeadRow(admin, auth.userId);
      return ok({
        threadId,
        beadCount: bead.count,
        messages: messages.map(item => ({
          id: item.id,
          text: item.message,
          text_en: item.message_en || "",
        })),
      });
    }

    const aiQuota = await consumeDailyAiQuota(admin, auth.userId, 1, {
      endpoint: "story_translate",
      thread_id: threadId,
      message_count: korean.length,
    });

    const debitRequestId = `story:translate:${auth.userId}:${threadId}:${randomUUID()}`;
    const beadCount = await debitBeads(admin, auth.userId, 1, debitRequestId);
    debitedCost = 1;

    const translated = await translateKoreanParagraphs(korean);
    await updateMessageTranslations(admin, threadId, translated);
    await trackUserActivityBestEffort(
      admin,
      auth.userId,
      "translation_success",
      {
        thread_id: threadId,
        translated_count: translated.length,
      },
      request,
    );

    const updated = await getMessagesForThread(admin, threadId);

    return ok(
      {
        threadId,
        beadCount,
        messages: updated.map(item => ({
          id: item.id,
          text: item.message,
          text_en: item.message_en || "",
        })),
      },
      {
        headers: {
          "x-quota-ai-used": String(aiQuota.used),
          "x-quota-ai-remaining": String(aiQuota.remaining),
        },
      },
    );
  } catch (error) {
    if (admin && debitedCost > 0) {
      try {
        await creditBeads(admin, auth.userId, debitedCost);
      } catch (refundError) {
        logError("/api/v1/story/translate refund", refundError, {
          requestId,
          userId: auth.userId,
        });
      }
    }

    if (error instanceof AiServiceConfigurationError) {
      return fail(503, "AI service is not configured");
    }

    if (
      error instanceof DailyQuotaExceededError &&
      error.code === "DAILY_AI_COST_LIMIT_EXCEEDED"
    ) {
      return fail(429, "Daily AI budget exceeded");
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_BEADS") {
      return fail(402, "Not enough beads");
    }
    if (error instanceof Error && error.message === "THREAD_NOT_FOUND") {
      return fail(404, "Thread not found");
    }

    logError("/api/v1/story/translate", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to translate story");
  }
}
