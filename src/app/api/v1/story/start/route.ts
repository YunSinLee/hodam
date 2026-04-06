import { NextRequest } from "next/server";

import { randomUUID } from "crypto";

import {
  AiServiceConfigurationError,
  generateStoryImageBase64,
  generateStoryTurn,
} from "@/lib/ai/story-service";
import { authenticateRequest } from "@/lib/auth/request-auth";
import { detectBlockedTopic } from "@/lib/safety/content-policy";
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
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface StartStoryRequestBody {
  keywords: string;
  includeEnglish?: boolean;
  includeImage?: boolean;
}

const MAX_KEYWORD_COUNT = 8;
const MAX_KEYWORD_LENGTH = 30;
const MAX_KEYWORDS_INPUT_LENGTH = 200;

function normalizeKeywords(rawKeywords: string): string[] {
  const deduplicated = new Set(
    rawKeywords
      .split(",")
      .map(item => item.trim())
      .filter(Boolean),
  );
  return Array.from(deduplicated);
}

export async function POST(request: NextRequest) {
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`story:start:${auth.userId}`, 20, 60_000)) {
    return fail(429, "Too many story generation requests");
  }

  let body: StartStoryRequestBody;
  try {
    body = (await request.json()) as StartStoryRequestBody;
  } catch (error) {
    return fail(400, "Invalid JSON body");
  }

  if (typeof body.keywords !== "string") {
    return fail(400, "keywords must be a string");
  }

  if (body.keywords.length > MAX_KEYWORDS_INPUT_LENGTH) {
    return fail(
      400,
      `keywords input is too long (max ${MAX_KEYWORDS_INPUT_LENGTH})`,
    );
  }

  const keywords = normalizeKeywords(body.keywords);
  if (keywords.length === 0) {
    return fail(400, "At least one keyword is required");
  }
  if (keywords.length > MAX_KEYWORD_COUNT) {
    return fail(400, `Too many keywords (max ${MAX_KEYWORD_COUNT})`);
  }
  if (keywords.some(keyword => keyword.length > MAX_KEYWORD_LENGTH)) {
    return fail(
      400,
      `Each keyword must be at most ${MAX_KEYWORD_LENGTH} characters`,
    );
  }

  const blockedTopic = detectBlockedTopic(keywords);
  if (blockedTopic) {
    return fail(400, "Unsafe content topic is not allowed");
  }

  const includeEnglish = Boolean(body.includeEnglish);
  const includeImage = Boolean(body.includeImage);
  const cost = 1 + (includeEnglish ? 1 : 0) + (includeImage ? 1 : 0);

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let debitedCost = 0;
  try {
    admin = createSupabaseAdminClient({
      fallbackAccessToken: auth.accessToken,
    });
    await trackUserActivityBestEffort(
      admin,
      auth.userId,
      "create_start",
      {
        include_english: includeEnglish,
        include_image: includeImage,
        keyword_count: keywords.length,
      },
      request,
    );

    const aiQuota = await consumeDailyAiQuota(admin, auth.userId, cost, {
      endpoint: "story_start",
      include_english: includeEnglish,
      include_image: includeImage,
      keyword_count: keywords.length,
    });

    const debitRequestId = `story:start:${auth.userId}:${randomUUID()}`;
    const beadCount = await debitBeads(
      admin,
      auth.userId,
      cost,
      debitRequestId,
    );
    debitedCost = cost;

    const thread = await createStoryThread(admin, auth.userId, {
      includeEnglish,
      includeImage,
    });

    await saveKeywords(admin, thread.id, keywords);

    const storyTurn = await generateStoryTurn({
      keywords,
      includeEnglish,
    });

    const turn = 0;
    await saveStoryTurn(admin, thread.id, turn, storyTurn);
    await appendThreadRawText(admin, thread, storyTurn);

    let imageUrl: string | null = null;
    if (includeImage) {
      const base64Image = await generateStoryImageBase64(storyTurn.imagePrompt);
      if (base64Image) {
        imageUrl = await uploadThreadImage(
          admin,
          auth.userId,
          thread.id,
          base64Image,
        );
        await trackUserActivityBestEffort(
          admin,
          auth.userId,
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
      auth.userId,
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
        await creditBeads(admin, auth.userId, debitedCost);
      } catch (refundError) {
        logError("/api/v1/story/start refund", refundError, {
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

    logError("/api/v1/story/start", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to start story");
  }
}
