import {
  ThreadDetailResponseSchema,
  ThreadListResponseSchema,
} from "@/app/api/v1/schemas";
import type {
  ThreadDetailResponse,
  ThreadListResponse,
} from "@/app/api/v1/types";
import type { ThreadWithUser } from "@/app/types/openai";
import {
  authorizedFetch,
  authorizedFetchWithMeta,
} from "@/lib/client/api/http";

export interface ThreadListDiagnostics {
  source: string;
  degraded: boolean;
  reasons: string[];
}

export interface ThreadListWithDiagnostics {
  threads: ThreadWithUser[];
  diagnostics: ThreadListDiagnostics;
}

const THREAD_LIST_UNAVAILABLE_REASONS = new Set([
  "rpc_error",
  "rpc_exception",
  "fallback_error",
  "fallback_exception",
]);

export function isThreadListUnavailable(
  result: ThreadListWithDiagnostics,
): boolean {
  if (!result.diagnostics.degraded) return false;
  if (result.diagnostics.source !== "none") return false;
  if (result.threads.length > 0) return false;

  return result.diagnostics.reasons.some(reason =>
    THREAD_LIST_UNAVAILABLE_REASONS.has(reason),
  );
}

const threadApi = {
  async getThreadDetail(thread_id: number): Promise<ThreadDetailResponse> {
    return authorizedFetch<ThreadDetailResponse>(
      `/api/v1/threads/${thread_id}`,
      {
        method: "GET",
      },
      ThreadDetailResponseSchema,
    );
  },

  async fetchThreadsByUserId(): Promise<ThreadWithUser[]> {
    const result = await this.fetchThreadsByUserIdWithDiagnostics();
    return result.threads;
  },

  async fetchThreadsByUserIdWithDiagnostics(): Promise<ThreadListWithDiagnostics> {
    const { data, headers } = await authorizedFetchWithMeta<ThreadListResponse>(
      "/api/v1/threads",
      {
        method: "GET",
      },
      ThreadListResponseSchema,
    );

    const source = headers.get("x-hodam-threads-source") || "unknown";
    const degraded = headers.get("x-hodam-threads-degraded") === "1";
    const reasons = (headers.get("x-hodam-threads-degraded-reasons") || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

    return {
      threads: data.threads || [],
      diagnostics: {
        source,
        degraded,
        reasons,
      },
    };
  },
};

export default threadApi;
