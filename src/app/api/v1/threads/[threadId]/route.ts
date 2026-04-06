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
  user_id: string;
  able_english: boolean;
  has_image: boolean;
  raw_text: string | null;
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
    const { data: threadDetailData, error: threadDetailError } =
      await userClient.rpc("get_thread_detail", {
        p_thread_id: threadId,
      });

    let thread: ThreadResponseRow | null = null;
    let messages: ThreadMessageRow[] | null = null;

    if (threadDetailError) {
      logError("/api/v1/threads/[threadId] rpc get_thread_detail failed", {
        threadId,
        error: threadDetailError,
        requestId,
      });
    } else {
      const rpcRows = Array.isArray(threadDetailData)
        ? (threadDetailData as ThreadDetailRpcRow[])
        : [];
      const rpcRow = rpcRows[0];
      if (rpcRow) {
        thread = rpcRow.thread_row;
        messages = Array.isArray(rpcRow.messages) ? rpcRow.messages : [];
      }
    }

    if (!thread) {
      thread = await getThreadForUser(userClient, threadId, auth.userId);
    }
    if (!messages) {
      messages = await getMessagesForThread(userClient, threadId);
    }

    const imageUrl = await getLatestThreadImageSignedUrl(
      userClient,
      auth.userId,
      threadId,
    );

    return okWithRequestId({
      thread,
      imageUrl,
      messages: messages.map(item => ({
        id: item.id,
        turn: item.turn,
        text: item.message,
        text_en: item.message_en || "",
        created_at: item.created_at,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "THREAD_NOT_FOUND") {
      return failWithRequestId(404, "Thread not found");
    }
    logError("/api/v1/threads/[threadId]", error, { requestId });
    return failWithRequestId(500, "Failed to fetch thread detail");
  }
}
