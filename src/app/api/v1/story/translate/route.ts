import { NextRequest } from "next/server";

import { randomUUID } from "crypto";

import {
  AiServiceConfigurationError,
  translateKoreanParagraphs,
} from "@/lib/ai/story-service";
import { authenticateRequest } from "@/lib/auth/request-auth";
import { detectBlockedTopic } from "@/lib/safety/content-policy";
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
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/story/translate authenticateRequest", error, {
      requestId,
    });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (!checkRateLimit(`story:translate:${authContext.userId}`, 15, 60_000)) {
    return failWithCode(
      429,
      "Too many translation requests",
      "STORY_TRANSLATE_RATE_LIMITED",
    );
  }

  let body: TranslateStoryRequestBody;
  try {
    body = (await request.json()) as TranslateStoryRequestBody;
  } catch (error) {
    return failWithCode(400, "Invalid JSON body", "REQUEST_JSON_INVALID");
  }

  const threadId = Number(body.threadId);
  if (!Number.isFinite(threadId) || threadId <= 0) {
    return failWithCode(
      400,
      "Valid threadId is required",
      "STORY_TRANSLATE_THREAD_ID_INVALID",
    );
  }

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let debitedCost = 0;
  try {
    admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });
    await getThreadForUser(admin, threadId, authContext.userId);
    await trackUserActivityBestEffort(
      admin,
      authContext.userId,
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
      const bead = await ensureBeadRow(admin, authContext.userId);
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

    const aiQuota = await consumeDailyAiQuota(admin, authContext.userId, 1, {
      endpoint: "story_translate",
      thread_id: threadId,
      message_count: korean.length,
    });

    const debitRequestId = `story:translate:${authContext.userId}:${threadId}:${randomUUID()}`;
    const beadCount = await debitBeads(
      admin,
      authContext.userId,
      1,
      debitRequestId,
    );
    debitedCost = 1;

    const translated = await translateKoreanParagraphs(korean);
    const blockedOutputTopic = detectBlockedTopic(translated);
    if (blockedOutputTopic) {
      throw new Error("BLOCKED_TRANSLATION_OUTPUT");
    }
    await updateMessageTranslations(admin, threadId, translated);
    await trackUserActivityBestEffort(
      admin,
      authContext.userId,
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
        await creditBeads(admin, authContext.userId, debitedCost);
      } catch (refundError) {
        logError("/api/v1/story/translate refund", refundError, {
          requestId,
          userId: authContext.userId,
        });
      }
    }

    if (error instanceof AiServiceConfigurationError) {
      return failWithCode(
        503,
        "AI service is not configured",
        "AI_SERVICE_NOT_CONFIGURED",
      );
    }

    if (
      error instanceof DailyQuotaExceededError &&
      error.code === "DAILY_AI_COST_LIMIT_EXCEEDED"
    ) {
      return failWithCode(
        429,
        "Daily AI budget exceeded",
        "AI_DAILY_BUDGET_EXCEEDED",
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_BEADS") {
      return failWithCode(402, "Not enough beads", "BEADS_INSUFFICIENT");
    }
    if (
      error instanceof Error &&
      error.message === "BLOCKED_TRANSLATION_OUTPUT"
    ) {
      return failWithCode(
        400,
        "Generated translation contained unsafe topic",
        "STORY_TRANSLATE_BLOCKED_OUTPUT",
      );
    }
    if (error instanceof Error && error.message === "THREAD_NOT_FOUND") {
      return failWithCode(404, "Thread not found", "THREAD_NOT_FOUND");
    }

    logError("/api/v1/story/translate", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(
      500,
      "Failed to translate story",
      "STORY_TRANSLATE_FAILED",
    );
  }
}
