import { NextRequest } from "next/server";

import { parsePicturebookDraft } from "@/app/utils/picturebook";
import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import { ReadingStateInputSchema } from "@/lib/picturebook/reading-state";
import { getThreadForUser } from "@/lib/server/hodam-repo";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { toReadingStateBook } from "@/lib/server/reading-state";
import { createApiRequestContext } from "@/lib/server/request-context";

interface RouteContext {
  params: Promise<{ threadId: string }>;
}
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function PUT(request: NextRequest, context: RouteContext) {
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
  if (!auth) return fail(401, "로그인이 필요합니다.", "AUTH_UNAUTHORIZED");
  const owner = request.headers.get("x-hodam-owner-id");
  if (!owner) {
    return fail(400, "계정 정보를 확인해 주세요.", "AUTH_OWNER_REQUIRED");
  }
  if (owner !== auth.userId) {
    return fail(409, "로그인 계정이 바뀌었어요.", "AUTH_OWNER_CHANGED");
  }
  const { threadId: rawId } = await context.params;
  const threadId = Number(rawId);
  if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(threadId)) {
    return fail(400, "책 번호가 올바르지 않습니다.", "THREAD_ID_INVALID");
  }
  if (!checkRateLimit(`reading-state:write:${auth.userId}`, 180, 60_000)) {
    return fail(
      429,
      "잠시 후 다시 시도해 주세요.",
      "READING_STATE_RATE_LIMITED",
    );
  }

  let input: ReturnType<typeof ReadingStateInputSchema.parse>;
  try {
    if (Number(request.headers.get("content-length")) > 1024) {
      return fail(
        400,
        "읽기 기록 형식을 확인해 주세요.",
        "READING_STATE_INVALID",
      );
    }
    const body = await request.text();
    if (body.length > 1024) {
      return fail(
        400,
        "읽기 기록 형식을 확인해 주세요.",
        "READING_STATE_INVALID",
      );
    }
    const parsed = ReadingStateInputSchema.safeParse(JSON.parse(body));
    if (!parsed.success) {
      return fail(
        400,
        "읽기 기록 형식을 확인해 주세요.",
        "READING_STATE_INVALID",
      );
    }
    input = parsed.data;
  } catch {
    return fail(
      400,
      "읽기 기록 형식을 확인해 주세요.",
      "READING_STATE_INVALID",
    );
  }

  try {
    const client = requireUserClient(auth.accessToken);
    const thread = await getThreadForUser(client, threadId, auth.userId);
    const book = parsePicturebookDraft(thread.raw_text);
    if (!book) {
      return fail(
        409,
        "그림책에서 읽기 기록을 저장해 주세요.",
        "READING_BOOK_INVALID",
      );
    }
    if (input.field === "progress") {
      const { progress } = input;
      if (
        progress.pageCount > book.pages.length ||
        progress.pageIndex >= book.pages.length ||
        (progress.completed &&
          progress.pageCount === book.pages.length &&
          (book.status !== "complete" ||
            progress.pageIndex < Math.max(0, book.pages.length - 2)))
      ) {
        return fail(
          409,
          "책의 내용이 바뀌었어요. 책을 다시 열어 주세요.",
          "READING_BOOK_CHANGED",
        );
      }
    }
    // A bookmark from the first four pages remains valid after the ending is
    // saved. Normalize to the current book length without claiming completion.
    const progress =
      input.field === "progress"
        ? {
            ...input.progress,
            pageCount: book.pages.length,
            completed:
              input.progress.completed &&
              input.progress.pageCount === book.pages.length,
          }
        : null;

    const { data, error } = await client.rpc("save_reading_state", {
      p_thread_id: threadId,
      p_field: input.field,
      p_expected_version: input.expectedVersion,
      p_favorite: input.field === "favorite" ? input.favorite : null,
      p_page_index: progress?.pageIndex ?? null,
      p_page_count: progress?.pageCount ?? null,
      p_completed: progress?.completed ?? null,
    });
    if (error) throw error;
    const row = data?.[0];
    if (!row || typeof row.applied !== "boolean") {
      throw new Error("READING_STATE_SAVE_EMPTY");
    }
    return ok(
      { book: toReadingStateBook(row), applied: row.applied },
      { headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "THREAD_NOT_FOUND") {
      return fail(404, "책을 찾을 수 없습니다.", "THREAD_NOT_FOUND");
    }
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      error.message === "READING_STATE_VERSION_EXHAUSTED"
    ) {
      return fail(
        409,
        "이 기록은 추가로 변경할 수 없어요.",
        "READING_STATE_VERSION_EXHAUSTED",
      );
    }
    logError("reading_state unavailable", error, { requestId });
    return fail(
      503,
      "읽기 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      "READING_STATE_UNAVAILABLE",
    );
  }
}
