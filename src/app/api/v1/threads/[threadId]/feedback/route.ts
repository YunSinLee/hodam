import { NextRequest } from "next/server";

import { parsePicturebookDraft } from "@/app/utils/picturebook";
import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import {
  ReadingFeedbackInputSchema,
  ReadingFeedbackSchema,
} from "@/lib/picturebook/reading-feedback";
import { getThreadForUser } from "@/lib/server/hodam-repo";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";

interface RouteContext {
  params: Promise<{ threadId: string }>;
}

const privateHeaders = { "Cache-Control": "private, no-store" };

async function handleFeedback(
  request: NextRequest,
  context: RouteContext,
  write: boolean,
) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  const fail = (status: number, message: string, code: string) =>
    failWithCode(status, message, code, undefined, {
      headers: privateHeaders,
    });

  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch {
    return fail(401, "로그인이 필요합니다.", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return fail(401, "로그인이 필요합니다.", "AUTH_UNAUTHORIZED");
  }
  // A session refresh can race with an account change. Never attach a stale
  // screen's response to the newly signed-in account.
  const expectedOwner = request.headers.get("x-hodam-owner-id");
  if (expectedOwner && expectedOwner !== auth.userId) {
    return fail(409, "로그인 계정이 바뀌었어요.", "AUTH_OWNER_CHANGED");
  }

  const { threadId: rawThreadId } = await context.params;
  const threadId = Number(rawThreadId);
  if (
    !/^\d+$/.test(rawThreadId) ||
    !Number.isSafeInteger(threadId) ||
    threadId <= 0
  ) {
    return fail(400, "책 번호가 올바르지 않습니다.", "THREAD_ID_INVALID");
  }
  if (
    !checkRateLimit(
      `feedback:${write ? "write" : "read"}:${auth.userId}`,
      write ? 20 : 60,
      60_000,
    )
  ) {
    return fail(429, "잠시 후 다시 시도해 주세요.", "FEEDBACK_RATE_LIMITED");
  }

  let input: ReturnType<typeof ReadingFeedbackInputSchema.parse> | null = null;
  if (write) {
    try {
      if (Number(request.headers.get("content-length")) > 1024) {
        return fail(400, "반응 형식을 확인해 주세요.", "FEEDBACK_INVALID");
      }
      const rawBody = await request.text();
      if (rawBody.length > 1024) {
        return fail(400, "반응 형식을 확인해 주세요.", "FEEDBACK_INVALID");
      }
      const parsed = ReadingFeedbackInputSchema.safeParse(JSON.parse(rawBody));
      if (!parsed.success) {
        return fail(400, "반응 형식을 확인해 주세요.", "FEEDBACK_INVALID");
      }
      input = parsed.data;
    } catch {
      return fail(400, "반응 형식을 확인해 주세요.", "FEEDBACK_INVALID");
    }
  }

  try {
    const client = requireUserClient(auth.accessToken);
    const thread = await getThreadForUser(client, threadId, auth.userId);
    if (
      write &&
      parsePicturebookDraft(thread.raw_text)?.status !== "complete"
    ) {
      return fail(
        409,
        "완성된 그림책에 반응을 남겨 주세요.",
        "BOOK_NOT_COMPLETE",
      );
    }
    const result = input
      ? await client.rpc("save_reading_feedback", {
          p_thread_id: threadId,
          p_rating: input.rating,
          p_reason: input.reason,
        })
      : await client
          .from("reading_feedback")
          .select("rating, reason, updated_at")
          .eq("thread_id", threadId)
          .eq("user_id", auth.userId)
          .maybeSingle();
    if (result.error) throw result.error;
    const row = input ? result.data?.[0] : result.data;
    if (input && !row) throw new Error("FEEDBACK_SAVE_EMPTY");
    const feedback = row
      ? ReadingFeedbackSchema.parse({
          rating: row.rating,
          reason: row.reason,
          updatedAt: row.updated_at,
        })
      : null;
    return ok({ feedback }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "THREAD_NOT_FOUND") {
      return fail(404, "책을 찾을 수 없습니다.", "THREAD_NOT_FOUND");
    }
    // Do not send the book, the rating body, or user input to logs/analytics.
    logError("reading_feedback unavailable", error, { requestId });
    return fail(
      503,
      "반응을 저장하는 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.",
      "FEEDBACK_UNAVAILABLE",
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleFeedback(request, context, false);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleFeedback(request, context, true);
}
