import { NextRequest } from "next/server";

import { randomUUID } from "crypto";

import {
  AiServiceConfigurationError,
  generateStoryImageBase64,
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
  createStoryThread,
  debitBeads,
  saveKeywords,
  saveStoryTurn,
  uploadThreadImage,
} from "@/lib/server/hodam-repo";
import { logError } from "@/lib/server/logger";
import {
  DailyQuotaExceededError,
  consumeDailyAiQuota,
} from "@/lib/server/quota";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import {
  calculateStoryStartCost,
  normalizeStoryKeywords,
} from "@/lib/story/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface StartStoryRequestBody {
  keywords: string;
  includeEnglish?: boolean;
  includeImage?: boolean;
}

const MAX_KEYWORD_COUNT = 8;
const MAX_KEYWORD_LENGTH = 30;
const MAX_KEYWORDS_INPUT_LENGTH = 200;

export async function POST(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/story/start authenticateRequest", error, { requestId });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (!checkRateLimit(`story:start:${authContext.userId}`, 20, 60_000)) {
    return failWithCode(
      429,
      "Too many story generation requests",
      "STORY_START_RATE_LIMITED",
    );
  }

  let body: StartStoryRequestBody;
  try {
    body = (await request.json()) as StartStoryRequestBody;
  } catch (error) {
    return failWithCode(400, "Invalid JSON body", "REQUEST_JSON_INVALID");
  }

  if (typeof body.keywords !== "string") {
    return failWithCode(
      400,
      "keywords must be a string",
      "STORY_START_KEYWORDS_TYPE_INVALID",
    );
  }

  if (body.keywords.length > MAX_KEYWORDS_INPUT_LENGTH) {
    return failWithCode(
      400,
      `keywords input is too long (max ${MAX_KEYWORDS_INPUT_LENGTH})`,
      "STORY_START_KEYWORDS_INPUT_TOO_LONG",
    );
  }

  const keywords = normalizeStoryKeywords(body.keywords);
  if (keywords.length === 0) {
    return failWithCode(
      400,
      "At least one keyword is required",
      "STORY_START_KEYWORDS_REQUIRED",
    );
  }
  if (keywords.length > MAX_KEYWORD_COUNT) {
    return failWithCode(
      400,
      `Too many keywords (max ${MAX_KEYWORD_COUNT})`,
      "STORY_START_KEYWORDS_TOO_MANY",
    );
  }
  if (keywords.some(keyword => keyword.length > MAX_KEYWORD_LENGTH)) {
    return failWithCode(
      400,
      `Each keyword must be at most ${MAX_KEYWORD_LENGTH} characters`,
      "STORY_START_KEYWORD_TOO_LONG",
    );
  }

  const blockedTopic = detectBlockedTopic(keywords);
  if (blockedTopic) {
    return failWithCode(
      400,
      "Unsafe content topic is not allowed",
      "STORY_START_BLOCKED_TOPIC",
    );
  }

  const includeEnglish = Boolean(body.includeEnglish);
  const includeImage = Boolean(body.includeImage);
  const cost = calculateStoryStartCost({
    includeEnglish,
    includeImage,
  });

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let debitedCost = 0;
  try {
    admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });
    await trackUserActivityBestEffort(
      admin,
      authContext.userId,
      "create_start",
      {
        include_english: includeEnglish,
        include_image: includeImage,
        keyword_count: keywords.length,
      },
      request,
    );

    const aiQuota = await consumeDailyAiQuota(admin, authContext.userId, cost, {
      endpoint: "story_start",
      include_english: includeEnglish,
      include_image: includeImage,
      keyword_count: keywords.length,
    });

    const debitRequestId = `story:start:${authContext.userId}:${randomUUID()}`;
    const beadCount = await debitBeads(
      admin,
      authContext.userId,
      cost,
      debitRequestId,
    );
    debitedCost = cost;

    const thread = await createStoryThread(admin, authContext.userId, {
      includeEnglish,
      includeImage,
    });

    await saveKeywords(admin, thread.id, keywords);

    const storyTurn = await generateStoryTurn({
      keywords,
      includeEnglish,
    });

    const blockedOutputTopic = detectBlockedTopicInStoryOutput(storyTurn);
    if (blockedOutputTopic) {
      throw new Error("BLOCKED_STORY_OUTPUT");
    }

    const turn = 0;
    await saveStoryTurn(admin, thread.id, turn, storyTurn);
    await appendThreadRawText(admin, thread, storyTurn);

    let imageUrl: string | null = null;
    if (includeImage) {
      const base64Image = await generateStoryImageBase64(storyTurn.imagePrompt);
      if (base64Image) {
        imageUrl = await uploadThreadImage(
          admin,
          authContext.userId,
          thread.id,
          base64Image,
        );
        await trackUserActivityBestEffort(
          admin,
          authContext.userId,
          "image_generated",
          {
            thread_id: thread.id,
            turn,
          },
          request,
        );
      }
    }

    await trackUserActivityBestEffort(
      admin,
      authContext.userId,
      "create_success",
      {
        thread_id: thread.id,
        turn,
        include_english: includeEnglish,
        include_image: includeImage,
        cost,
      },
      request,
    );

    return ok(
      {
        threadId: thread.id,
        turn,
        beadCount,
        includeEnglish,
        includeImage,
        notice: storyTurn.notice,
        imageUrl,
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
        logError("/api/v1/story/start refund", refundError, {
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
        "STORY_START_BLOCKED_OUTPUT",
      );
    }

    logError("/api/v1/story/start", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(500, "Failed to start story", "STORY_START_FAILED");
  }
}
