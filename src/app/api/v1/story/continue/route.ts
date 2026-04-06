import { NextRequest } from "next/server";

import { randomUUID } from "crypto";

import {
  AiServiceConfigurationError,
  generateStoryTurn,
} from "@/lib/ai/story-service";
import { authenticateRequest } from "@/lib/auth/request-auth";
import { detectBlockedTopic } from "@/lib/safety/content-policy";
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
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface ContinueStoryRequestBody {
  threadId: number;
  selection: string;
}

const MAX_SELECTION_LENGTH = 200;

export async function POST(request: NextRequest) {
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`story:continue:${auth.userId}`, 30, 60_000)) {
    return fail(429, "Too many story continuation requests");
  }

  let body: ContinueStoryRequestBody;
  try {
    body = (await request.json()) as ContinueStoryRequestBody;
  } catch (error) {
    return fail(400, "Invalid JSON body");
  }

  const threadId = Number(body.threadId);
  const selectionRaw = body.selection;
  const selection = typeof selectionRaw === "string" ? selectionRaw.trim() : "";

  if (!Number.isFinite(threadId) || threadId <= 0) {
    return fail(400, "Valid threadId is required");
  }

  if (!selection) {
    return fail(400, "Selection is required");
  }
  if (selection.length > MAX_SELECTION_LENGTH) {
    return fail(
      400,
      `Selection is too long (max ${MAX_SELECTION_LENGTH} characters)`,
    );
  }

  const blockedTopic = detectBlockedTopic([selection]);
  if (blockedTopic) {
    return fail(400, "Unsafe content topic is not allowed");
  }

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let debitedCost = 0;
  try {
    admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
    });
    const thread = await getThreadForUser(admin, threadId, auth.userId);

    const cost = 1 + (thread.able_english ? 1 : 0);
    const aiQuota = await consumeDailyAiQuota(admin, auth.userId, cost, {
      endpoint: "story_continue",
      thread_id: threadId,
      include_english: thread.able_english,
    });

    const debitRequestId = `story:continue:${auth.userId}:${threadId}:${randomUUID()}`;
    const beadCount = await debitBeads(
      admin,
      auth.userId,
      cost,
      debitRequestId,
    );
    debitedCost = cost;

    const storyTurn = await generateStoryTurn({
      storyContext: thread.raw_text || "",
      userSelection: selection,
      includeEnglish: thread.able_english,
    });

    const turn = await getNextTurn(admin, thread.id);

    await saveStoryTurn(admin, thread.id, turn, storyTurn);
    await appendThreadRawText(admin, thread, storyTurn);
    await trackUserActivityBestEffort(
      admin,
      auth.userId,
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
        await creditBeads(admin, auth.userId, debitedCost);
      } catch (refundError) {
        logError("/api/v1/story/continue refund", refundError, {
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

    logError("/api/v1/story/continue", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to continue story");
  }
}
