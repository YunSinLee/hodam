import { NextRequest } from "next/server";

import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import {
  getLatestThreadImageSignedUrl,
  getMessagesForThread,
  getThreadForUser,
} from "@/lib/server/hodam-repo";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";

interface ThreadResponseRow {
  id: number;
  openai_thread_id: string;
  created_at: string;
  user_id: string;
  able_english: boolean;
  has_image: boolean;
}

interface ThreadLikeInput {
  id?: unknown;
  openai_thread_id?: unknown;
  created_at?: unknown;
  user_id?: unknown;
  able_english?: unknown;
  has_image?: unknown;
}

function toThreadSummary(
  thread: ThreadLikeInput | null,
): ThreadResponseRow | null {
  if (!thread || typeof thread !== "object") return null;

  const threadId = Number(thread.id);
  if (!Number.isFinite(threadId) || threadId <= 0) {
    return null;
  }

  return {
    id: threadId,
    openai_thread_id:
      typeof thread.openai_thread_id === "string"
        ? thread.openai_thread_id
        : "",
    created_at: typeof thread.created_at === "string" ? thread.created_at : "",
    user_id: typeof thread.user_id === "string" ? thread.user_id : "",
    able_english: Boolean(thread.able_english),
    has_image: Boolean(thread.has_image),
  };
}

interface ThreadMessageRow {
  id: number;
  turn: number;
  message: string;
  message_en?: string | null;
  created_at: string;
}

interface ThreadDetailRpcRow {
  thread_row: ThreadResponseRow | null;
  messages: ThreadMessageRow[] | null;
}

type ThreadDetailSource = "rpc" | "fallback" | "none";

function buildThreadDetailResponseHeaders(
  source: ThreadDetailSource,
  degradationReasons: string[],
) {
  const headers = new Headers({
    "x-hodam-threads-source": source,
  });

  if (degradationReasons.length > 0) {
    headers.set("x-hodam-threads-degraded", "1");
    headers.set(
      "x-hodam-threads-degraded-reasons",
      Array.from(new Set(degradationReasons)).join(","),
    );
  }

  return headers;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  const {
    fail: failWithRequestId,
    ok: okWithRequestId,
    requestId,
  } = createApiRequestContext(request);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return failWithRequestId(401, "Unauthorized");
  }

  if (!checkRateLimit(`threads:detail:${auth.userId}`, 120, 60_000)) {
    return failWithRequestId(429, "Too many thread detail requests");
  }

  const { threadId: threadIdParam } = await context.params;
  const threadId = Number(threadIdParam);
  if (!Number.isFinite(threadId) || threadId <= 0) {
    return failWithRequestId(400, "Invalid threadId");
  }

  try {
    const userClient = requireUserClient(auth.accessToken);
    const degradationReasons: string[] = [];
    let source: ThreadDetailSource = "none";
    let usedFallback = false;

    let rpcData: unknown = null;
    let rpcError: unknown = null;

    try {
      const rpcResult = await userClient.rpc("get_thread_detail", {
        p_thread_id: threadId,
      });
      rpcData = rpcResult.data;
      rpcError = rpcResult.error;
    } catch (rpcThrownError) {
      degradationReasons.push("rpc_exception");
      logError("/api/v1/threads/[threadId] rpc get_thread_detail threw", {
        threadId,
        error: rpcThrownError,
        requestId,
      });
    }

    if (rpcError) {
      degradationReasons.push("rpc_error");
      logError("/api/v1/threads/[threadId] rpc get_thread_detail failed", {
        threadId,
        error: rpcError,
        requestId,
      });
    }

    let thread: ThreadResponseRow | null = null;
    let messages: ThreadMessageRow[] | null = null;

    if (!rpcError && !degradationReasons.includes("rpc_exception")) {
      const rpcRows = Array.isArray(rpcData)
        ? (rpcData as ThreadDetailRpcRow[])
        : [];
      const rpcRow = rpcRows[0];
      if (rpcRow) {
        source = "rpc";
        thread = rpcRow.thread_row;
        if (Array.isArray(rpcRow.messages)) {
          messages = rpcRow.messages;
        } else {
          degradationReasons.push("rpc_missing_messages");
        }

        if (!thread) {
          degradationReasons.push("rpc_missing_thread");
        }
      } else {
        degradationReasons.push("rpc_empty");
      }
    }

    if (!thread) {
      usedFallback = true;
      thread = await getThreadForUser(userClient, threadId, auth.userId);
    }
    if (!messages) {
      usedFallback = true;
      messages = await getMessagesForThread(userClient, threadId);
    }

    if (usedFallback) {
      source = "fallback";
    }

    const threadSummary = toThreadSummary(thread);
    if (!threadSummary) {
      throw new Error("INVALID_THREAD_DETAIL_ROW");
    }

    const imageUrl = await getLatestThreadImageSignedUrl(
      userClient,
      auth.userId,
      threadId,
    );

    return okWithRequestId(
      {
        thread: threadSummary,
        imageUrl,
        messages: messages.map(item => ({
          id: item.id,
          turn: item.turn,
          text: item.message,
          text_en: item.message_en || "",
          created_at: item.created_at,
        })),
      },
      {
        headers: buildThreadDetailResponseHeaders(source, degradationReasons),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "THREAD_NOT_FOUND") {
      return failWithRequestId(404, "Thread not found");
    }
    logError("/api/v1/threads/[threadId]", error, { requestId });
    return failWithRequestId(500, "Failed to fetch thread detail");
  }
}
