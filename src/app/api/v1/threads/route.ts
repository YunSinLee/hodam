import { NextRequest } from "next/server";

import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";

interface ThreadRowLike {
  id: number;
  openai_thread_id: string;
  created_at: string;
  user_id: string;
  able_english: boolean;
  has_image: boolean;
  [key: string]: unknown;
}

type ThreadSource = "rpc" | "fallback" | "none";

const KEYWORD_BATCH_SIZE = 100;

function toThreadId(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function normalizeThreadRows(rows: unknown[]): {
  normalized: ThreadRowLike[];
  droppedMalformedRow: boolean;
} {
  let droppedMalformedRow = false;
  const normalized: ThreadRowLike[] = [];

  rows.forEach(row => {
    if (!row || typeof row !== "object") {
      droppedMalformedRow = true;
      return;
    }

    const threadId = toThreadId((row as { id?: unknown }).id);
    if (!threadId) {
      droppedMalformedRow = true;
      return;
    }

    const record = row as Record<string, unknown>;

    normalized.push({
      id: threadId,
      openai_thread_id:
        typeof record.openai_thread_id === "string"
          ? record.openai_thread_id
          : "",
      created_at:
        typeof record.created_at === "string" ? record.created_at : "",
      user_id: typeof record.user_id === "string" ? record.user_id : "",
      able_english: Boolean(record.able_english),
      has_image: Boolean(record.has_image),
    });
  });

  return { normalized, droppedMalformedRow };
}

function buildThreadResponseHeaders(
  source: ThreadSource,
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

export async function GET(request: NextRequest) {
  const {
    fail: failWithRequestId,
    ok: okWithRequestId,
    requestId,
  } = createApiRequestContext(request);

  const auth = await authenticateRequest(request);
  if (!auth) {
    return failWithRequestId(401, "Unauthorized");
  }

  if (!checkRateLimit(`threads:list:${auth.userId}`, 120, 60_000)) {
    return failWithRequestId(429, "Too many thread list requests");
  }

  try {
    const userClient = requireUserClient(auth.accessToken);
    let threadRows: ThreadRowLike[] = [];
    let source: ThreadSource = "none";
    const degradationReasons: string[] = [];

    const readThreadsWithFallback = async () => {
      try {
        const { data, error } = await userClient.rpc("get_my_threads");
        if (!error) {
          threadRows = Array.isArray(data) ? data : [];
          source = "rpc";
          return;
        }
        degradationReasons.push("rpc_error");
        logError("/api/v1/threads rpc get_my_threads failed", error, {
          requestId,
          userId: auth.userId,
        });
      } catch (rpcError) {
        degradationReasons.push("rpc_exception");
        logError("/api/v1/threads rpc get_my_threads threw", rpcError, {
          requestId,
          userId: auth.userId,
        });
      }

      // Fallback to direct select for environments where RPC drift exists.
      try {
        const { data: fallbackData, error: fallbackError } = await userClient
          .from("thread")
          .select(
            "id, openai_thread_id, created_at, user_id, able_english, has_image",
          )
          .eq("user_id", auth.userId)
          .order("created_at", { ascending: false });

        if (fallbackError) {
          degradationReasons.push("fallback_error");
          logError(
            "/api/v1/threads fallback thread query failed",
            fallbackError,
            {
              requestId,
              userId: auth.userId,
            },
          );
          threadRows = [];
          return;
        }

        threadRows = Array.isArray(fallbackData) ? fallbackData : [];
        source = "fallback";
      } catch (fallbackThrownError) {
        degradationReasons.push("fallback_exception");
        logError(
          "/api/v1/threads fallback thread query threw",
          fallbackThrownError,
          {
            requestId,
            userId: auth.userId,
          },
        );
        threadRows = [];
      }
    };

    await readThreadsWithFallback();

    const isThreadListUnavailable =
      source === "none" &&
      degradationReasons.some(reason =>
        [
          "fallback_error",
          "fallback_exception",
          "rpc_error",
          "rpc_exception",
        ].includes(reason),
      );

    if (isThreadListUnavailable) {
      return okWithRequestId(
        {
          threads: [],
        },
        {
          headers: buildThreadResponseHeaders(source, degradationReasons),
        },
      );
    }

    const { normalized: normalizedThreadRows, droppedMalformedRow } =
      normalizeThreadRows(threadRows as unknown[]);
    if (droppedMalformedRow) {
      degradationReasons.push("invalid_thread_rows");
    }

    const threadIds = normalizedThreadRows.map(thread => thread.id);
    const keywordsByThreadId = new Map<number, { keyword: string }[]>();

    if (threadIds.length > 0) {
      const keywordBatches = Array.from(
        { length: Math.ceil(threadIds.length / KEYWORD_BATCH_SIZE) },
        (_, index) =>
          threadIds.slice(
            index * KEYWORD_BATCH_SIZE,
            (index + 1) * KEYWORD_BATCH_SIZE,
          ),
      );

      try {
        const keywordResponses = await Promise.all(
          keywordBatches.map(batch =>
            userClient
              .from("keywords")
              .select("thread_id, keyword")
              .in("thread_id", batch),
          ),
        );

        keywordResponses.forEach(
          ({ data: keywordRows, error: keywordError }) => {
            if (keywordError) {
              degradationReasons.push("keywords_error");
              // Keywords are optional metadata; do not fail the thread list response.
              logError("/api/v1/threads keywords lookup", keywordError, {
                requestId,
                userId: auth.userId,
              });
              return;
            }

            (keywordRows || []).forEach(row => {
              if (!row || typeof row !== "object") {
                degradationReasons.push("keywords_invalid_row");
                return;
              }
              const keywordRow = row as {
                thread_id?: unknown;
                keyword?: unknown;
              };
              const threadId = toThreadId(keywordRow.thread_id);
              const { keyword } = keywordRow;
              if (!threadId || typeof keyword !== "string") {
                degradationReasons.push("keywords_invalid_row");
                return;
              }
              const existing = keywordsByThreadId.get(threadId) || [];
              existing.push({ keyword });
              keywordsByThreadId.set(threadId, existing);
            });
          },
        );
      } catch (keywordThrownError) {
        degradationReasons.push("keywords_exception");
        // If keyword query fails unexpectedly, still serve thread list.
        logError("/api/v1/threads keywords lookup threw", keywordThrownError, {
          requestId,
          userId: auth.userId,
        });
      }
    }

    const headers = buildThreadResponseHeaders(source, degradationReasons);

    return okWithRequestId(
      {
        threads: normalizedThreadRows.map(thread => ({
          ...thread,
          keywords: keywordsByThreadId.get(thread.id) || [],
          user: {
            id: auth.userId,
            email: auth.email,
            display_name: auth.email || "사용자",
          },
        })),
      },
      { headers },
    );
  } catch (error) {
    logError("/api/v1/threads", error, { requestId });
    return okWithRequestId(
      {
        threads: [],
      },
      {
        headers: buildThreadResponseHeaders("none", ["unexpected_exception"]),
      },
    );
  }
}
