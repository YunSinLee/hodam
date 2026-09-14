import { beforeEach, describe, expect, it, vi } from "vitest";

import threadApi, { isThreadListUnavailable } from "@/lib/client/api/thread";

const { authorizedFetchWithMetaMock } = vi.hoisted(() => ({
  authorizedFetchWithMetaMock: vi.fn(),
}));

vi.mock("@/lib/client/api/http", () => ({
  authorizedFetchWithMeta: authorizedFetchWithMetaMock,
}));

describe("threadApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads thread detail through /api/v1/threads/:id", async () => {
    authorizedFetchWithMetaMock.mockResolvedValue({
      data: {
        thread: { id: 12 },
        messages: [],
        imageUrl: null,
      },
      status: 200,
      headers: new Headers({
        "x-hodam-threads-source": "rpc",
      }),
    });

    const response = await threadApi.getThreadDetail(12);

    expect(response.thread.id).toBe(12);
    expect(authorizedFetchWithMetaMock).toHaveBeenCalledWith(
      "/api/v1/threads/12",
      {
        method: "GET",
      },
      expect.anything(),
    );
  });

  it("returns diagnostics from thread detail response headers", async () => {
    authorizedFetchWithMetaMock.mockResolvedValue({
      data: {
        thread: { id: 12 },
        messages: [],
        imageUrl: null,
      },
      status: 200,
      headers: new Headers({
        "x-hodam-threads-source": "fallback",
        "x-hodam-threads-degraded": "1",
        "x-hodam-threads-degraded-reasons": "rpc_error,rpc_missing_messages",
      }),
    });

    const result = await threadApi.getThreadDetailWithDiagnostics(12);

    expect(result.detail.thread.id).toBe(12);
    expect(result.diagnostics).toEqual({
      source: "fallback",
      degraded: true,
      reasons: ["rpc_error", "rpc_missing_messages"],
    });
  });

  it("loads thread list through /api/v1/threads", async () => {
    authorizedFetchWithMetaMock.mockResolvedValue({
      data: {
        threads: [{ id: 1 }, { id: 2 }],
      },
      status: 200,
      headers: new Headers({
        "x-hodam-threads-source": "rpc",
      }),
    });

    const threads = await threadApi.fetchThreadsByUserId();

    expect(threads).toHaveLength(2);
    expect(authorizedFetchWithMetaMock).toHaveBeenCalledWith(
      "/api/v1/threads",
      {
        method: "GET",
      },
      expect.anything(),
    );
  });

  it("returns empty list when response does not include threads", async () => {
    authorizedFetchWithMetaMock.mockResolvedValue({
      data: {},
      status: 200,
      headers: new Headers(),
    });

    const threads = await threadApi.fetchThreadsByUserId();

    expect(threads).toEqual([]);
  });

  it("returns diagnostics from thread list response headers", async () => {
    authorizedFetchWithMetaMock.mockResolvedValue({
      data: {
        threads: [{ id: 1 }],
      },
      status: 200,
      headers: new Headers({
        "x-hodam-threads-source": "fallback",
        "x-hodam-threads-degraded": "1",
        "x-hodam-threads-degraded-reasons": "rpc_error,keywords_error",
      }),
    });

    const result = await threadApi.fetchThreadsByUserIdWithDiagnostics();

    expect(result.threads).toHaveLength(1);
    expect(result.diagnostics).toEqual({
      source: "fallback",
      degraded: true,
      reasons: ["rpc_error", "keywords_error"],
    });
  });

  it("returns degraded empty list when thread list request fails with 5xx", async () => {
    authorizedFetchWithMetaMock.mockRejectedValue({
      status: 500,
      message: "Failed to fetch threads",
    });

    const result = await threadApi.fetchThreadsByUserIdWithDiagnostics();

    expect(result).toEqual({
      threads: [],
      diagnostics: {
        source: "none",
        degraded: true,
        reasons: ["request_retry_exhausted", "request_failed_500"],
      },
    });
    expect(authorizedFetchWithMetaMock).toHaveBeenCalledTimes(2);
  });

  it("retries once and returns data when second attempt succeeds", async () => {
    authorizedFetchWithMetaMock
      .mockRejectedValueOnce({
        status: 503,
        message: "Service unavailable",
      })
      .mockResolvedValueOnce({
        data: {
          threads: [{ id: 1 }],
        },
        status: 200,
        headers: new Headers({
          "x-hodam-threads-source": "fallback",
          "x-hodam-threads-degraded": "1",
          "x-hodam-threads-degraded-reasons": "rpc_error",
        }),
      });

    const result = await threadApi.fetchThreadsByUserIdWithDiagnostics();

    expect(result.threads).toEqual([{ id: 1 }]);
    expect(result.diagnostics).toEqual({
      source: "fallback",
      degraded: true,
      reasons: ["rpc_error"],
    });
    expect(authorizedFetchWithMetaMock).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-5xx errors from thread list request", async () => {
    const unauthorizedError = {
      status: 401,
      message: "Unauthorized",
    };
    authorizedFetchWithMetaMock.mockRejectedValue(unauthorizedError);

    await expect(threadApi.fetchThreadsByUserIdWithDiagnostics()).rejects.toBe(
      unauthorizedError,
    );
  });
});

describe("isThreadListUnavailable", () => {
  it("returns true for degraded none-source empty result with rpc/fallback failure", () => {
    const unavailable = isThreadListUnavailable({
      threads: [],
      diagnostics: {
        source: "none",
        degraded: true,
        reasons: ["rpc_error", "fallback_error"],
      },
    });

    expect(unavailable).toBe(true);
  });

  it("returns false when fallback returned data", () => {
    const unavailable = isThreadListUnavailable({
      threads: [{ id: 1 } as never],
      diagnostics: {
        source: "fallback",
        degraded: true,
        reasons: ["rpc_error"],
      },
    });

    expect(unavailable).toBe(false);
  });

  it("returns false when degraded reasons are non-critical", () => {
    const unavailable = isThreadListUnavailable({
      threads: [],
      diagnostics: {
        source: "none",
        degraded: true,
        reasons: ["keywords_error"],
      },
    });

    expect(unavailable).toBe(false);
  });

  it("returns true when degraded reason indicates repeated request failure", () => {
    const unavailable = isThreadListUnavailable({
      threads: [],
      diagnostics: {
        source: "none",
        degraded: true,
        reasons: ["request_retry_exhausted", "request_failed_500"],
      },
    });

    expect(unavailable).toBe(true);
  });
});
