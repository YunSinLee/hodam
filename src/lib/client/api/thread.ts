import {
  ThreadDetailResponseSchema,
  ThreadListResponseSchema,
} from "@/app/api/v1/schemas";
import type {
  ThreadDetailResponse,
  ThreadListResponse,
} from "@/app/api/v1/types";
import type { ThreadWithUser } from "@/app/types/openai";
import { authorizedFetchWithMeta } from "@/lib/client/api/http";

export interface ThreadDiagnostics {
  source: string;
  degraded: boolean;
  reasons: string[];
}

export interface ThreadDetailWithDiagnostics {
  detail: ThreadDetailResponse;
  diagnostics: ThreadDiagnostics;
}

export interface ThreadListWithDiagnostics {
  threads: ThreadWithUser[];
  diagnostics: ThreadDiagnostics;
}

const THREAD_LIST_UNAVAILABLE_REASONS = new Set([
  "rpc_error",
  "rpc_exception",
  "fallback_error",
  "fallback_exception",
]);
const THREAD_LIST_TRANSIENT_RETRY_DELAY_MS =
  process.env.NODE_ENV === "test" ? 1 : 250;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function toErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    Number.isFinite(Number((error as { status?: unknown }).status))
  ) {
    return Number((error as { status?: unknown }).status);
  }

  return null;
}

function isRetryableThreadListError(error: unknown): boolean {
  const status = toErrorStatus(error);
  return Boolean(status && status >= 500 && status < 600);
}

export function isThreadListUnavailable(
  result: ThreadListWithDiagnostics,
): boolean {
  if (!result.diagnostics.degraded) return false;
  if (result.diagnostics.source !== "none") return false;
  if (result.threads.length > 0) return false;

  return result.diagnostics.reasons.some(
    reason =>
      THREAD_LIST_UNAVAILABLE_REASONS.has(reason) ||
      reason === "request_retry_exhausted" ||
      reason.startsWith("request_failed_"),
  );
}

function parseThreadDiagnostics(headers: Headers): ThreadDiagnostics {
  const source = headers.get("x-hodam-threads-source") || "unknown";
  const degraded = headers.get("x-hodam-threads-degraded") === "1";
  const reasons = (headers.get("x-hodam-threads-degraded-reasons") || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  return {
    source,
    degraded,
    reasons,
  };
}

const threadApi = {
  async getThreadDetail(thread_id: number): Promise<ThreadDetailResponse> {
    const result = await this.getThreadDetailWithDiagnostics(thread_id);
    return result.detail;
  },

  async getThreadDetailWithDiagnostics(
    thread_id: number,
  ): Promise<ThreadDetailWithDiagnostics> {
    const { data, headers } =
      await authorizedFetchWithMeta<ThreadDetailResponse>(
        `/api/v1/threads/${thread_id}`,
        {
          method: "GET",
        },
        ThreadDetailResponseSchema,
      );

    return {
      detail: data,
      diagnostics: parseThreadDiagnostics(headers),
    };
  },

  async fetchThreadsByUserId(): Promise<ThreadWithUser[]> {
    const result = await this.fetchThreadsByUserIdWithDiagnostics();
    return result.threads;
  },

  async fetchThreadsByUserIdWithDiagnostics(): Promise<ThreadListWithDiagnostics> {
    try {
      const { data, headers } =
        await authorizedFetchWithMeta<ThreadListResponse>(
          "/api/v1/threads",
          {
            method: "GET",
          },
          ThreadListResponseSchema,
        );

      return {
        threads: data.threads || [],
        diagnostics: parseThreadDiagnostics(headers),
      };
    } catch (error) {
      if (!isRetryableThreadListError(error)) {
        throw error;
      }

      await sleep(THREAD_LIST_TRANSIENT_RETRY_DELAY_MS);

      try {
        const { data, headers } =
          await authorizedFetchWithMeta<ThreadListResponse>(
            "/api/v1/threads",
            {
              method: "GET",
            },
            ThreadListResponseSchema,
          );

        return {
          threads: data.threads || [],
          diagnostics: parseThreadDiagnostics(headers),
        };
      } catch (retryError) {
        if (!isRetryableThreadListError(retryError)) {
          throw retryError;
        }

        const status = toErrorStatus(retryError);
        const reasons: string[] = ["request_retry_exhausted"];
        if (status) {
          reasons.push(`request_failed_${status}`);
        }

        return {
          threads: [],
          diagnostics: {
            source: "none",
            degraded: true,
            reasons,
          },
        };
      }
    }
  },
};

export default threadApi;
