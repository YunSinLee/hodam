import { NextRequest } from "next/server";

import { randomUUID } from "crypto";

import {
  AiServiceConfigurationError,
  generateStoryTurn,
} from "@/lib/ai/story-service";
import { authenticateRequest } from "@/lib/auth/request-auth";
import {
  detectBlockedTopic,
  detectBlockedTopicInStoryOutput,
} from "@/lib/safety/content-policy";
import { trackUserActivityBestEffort } from "@/lib/server/analytics";
import {
  appendThreadRawText,
  creditBeads,
  debitBeads,
  getNextTurn,
  getThreadForUser,
  saveStoryTurn,
} from "@/lib/server/hodam-repo";
import { logError } from "@/lib/server/logger";
import {
  DailyQuotaExceededError,
  consumeDailyAiQuota,
} from "@/lib/server/quota";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { calculateStoryContinueCost } from "@/lib/story/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface ContinueStoryRequestBody {
  threadId: number;
  selection: string;
}

const MAX_SELECTION_LENGTH = 200;

export async function POST(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/story/continue authenticateRequest", error, {
      requestId,
    });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (!checkRateLimit(`story:continue:${authContext.userId}`, 30, 60_000)) {
    return failWithCode(
      429,
      "Too many story continuation requests",
      "STORY_CONTINUE_RATE_LIMITED",
    );
  }

  let body: ContinueStoryRequestBody;
  try {
    body = (await request.json()) as ContinueStoryRequestBody;
  } catch (error) {
    return failWithCode(400, "Invalid JSON body", "REQUEST_JSON_INVALID");
  }

  const threadId = Number(body.threadId);
  const selectionRaw = body.selection;
  const selection = typeof selectionRaw === "string" ? selectionRaw.trim() : "";

  if (!Number.isFinite(threadId) || threadId <= 0) {
    return failWithCode(
      400,
      "Valid threadId is required",
      "STORY_CONTINUE_THREAD_ID_INVALID",
    );
  }

  if (!selection) {
    return failWithCode(
      400,
      "Selection is required",
      "STORY_CONTINUE_SELECTION_REQUIRED",
    );
  }
  if (selection.length > MAX_SELECTION_LENGTH) {
    return failWithCode(
      400,
      `Selection is too long (max ${MAX_SELECTION_LENGTH} characters)`,
      "STORY_CONTINUE_SELECTION_TOO_LONG",
    );
  }

  const blockedTopic = detectBlockedTopic([selection]);
  if (blockedTopic) {
    return failWithCode(
      400,
      "Unsafe content topic is not allowed",
      "STORY_CONTINUE_BLOCKED_TOPIC",
    );
  }

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let debitedCost = 0;
  try {
    admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });
    const thread = await getThreadForUser(admin, threadId, authContext.userId);

    const cost = calculateStoryContinueCost(thread.able_english);
    const aiQuota = await consumeDailyAiQuota(admin, authContext.userId, cost, {
      endpoint: "story_continue",
      thread_id: threadId,
      include_english: thread.able_english,
    });

    const debitRequestId = `story:continue:${authContext.userId}:${threadId}:${randomUUID()}`;
    const beadCount = await debitBeads(
      admin,
      authContext.userId,
      cost,
      debitRequestId,
    );
    debitedCost = cost;

    const storyTurn = await generateStoryTurn({
      storyContext: thread.raw_text || "",
      userSelection: selection,
      includeEnglish: thread.able_english,
    });

    const blockedOutputTopic = detectBlockedTopicInStoryOutput(storyTurn);
    if (blockedOutputTopic) {
      throw new Error("BLOCKED_STORY_OUTPUT");
    }

    const turn = await getNextTurn(admin, thread.id);

    await saveStoryTurn(admin, thread.id, turn, storyTurn);
    await appendThreadRawText(admin, thread, storyTurn);
    await trackUserActivityBestEffort(
      admin,
      authContext.userId,
      "continue_step",
      {
        thread_id: thread.id,
        turn,
        include_english: thread.able_english,
        cost,
      },
      request,
    );

    return ok(
      {
        threadId: thread.id,
        turn,
        beadCount,
        notice: storyTurn.notice,
        messages: storyTurn.paragraphs.map((text, index) => ({
          text,
          text_en: storyTurn.paragraphsEn[index] || "",
        })),
        selections: storyTurn.choices.map((text, index) => ({
          text,
          text_en: storyTurn.choicesEn[index] || "",
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
        logError("/api/v1/story/continue refund", refundError, {
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
    if (error instanceof Error && error.message === "BLOCKED_STORY_OUTPUT") {
      return failWithCode(
        400,
        "Generated content contained unsafe topic",
        "STORY_CONTINUE_BLOCKED_OUTPUT",
      );
    }
    if (error instanceof Error && error.message === "THREAD_NOT_FOUND") {
      return failWithCode(404, "Thread not found", "THREAD_NOT_FOUND");
    }

    logError("/api/v1/story/continue", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(
      500,
      "Failed to continue story",
      "STORY_CONTINUE_FAILED",
    );
  }
}
