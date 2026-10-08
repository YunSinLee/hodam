import { NextRequest } from "next/server";

import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import {
  readingStateColumns,
  toReadingStateBook,
} from "@/lib/server/reading-state";
import { createApiRequestContext } from "@/lib/server/request-context";

const pageSize = 200;
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
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
  if (!checkRateLimit(`reading-library:${auth.userId}`, 60, 60_000)) {
    return fail(
      429,
      "잠시 후 다시 시도해 주세요.",
      "READING_STATE_RATE_LIMITED",
    );
  }

  const afterValues = request.nextUrl.searchParams.getAll("after");
  const after = afterValues.length ? Number(afterValues[0]) : 0;
  if (
    afterValues.length > 1 ||
    (afterValues.length > 0 &&
      (!/^[1-9]\d*$/.test(afterValues[0]) ||
        !Number.isSafeInteger(after) ||
        after <= 0))
  ) {
    return fail(
      400,
      "책장 조회 위치가 올바르지 않습니다.",
      "READING_CURSOR_INVALID",
    );
  }

  try {
    const client = requireUserClient(auth.accessToken);
    const { data, error } = await client
      .from("reading_state")
      .select(readingStateColumns)
      .eq("user_id", auth.userId)
      .gt("thread_id", after)
      .order("thread_id", { ascending: true })
      .limit(pageSize + 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("READING_STATE_INVALID_LIST");
    const books = data.slice(0, pageSize).map(toReadingStateBook);
    return ok(
      {
        books,
        nextCursor:
          data.length > pageSize ? books[pageSize - 1].threadId : null,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    logError("reading_library unavailable", error, { requestId });
    return fail(
      503,
      "책장의 읽기 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      "READING_STATE_UNAVAILABLE",
    );
  }
}
