import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequestMock, requireUserClientMock, checkRateLimitMock } =
  vi.hoisted(() => ({
    authenticateRequestMock: vi.fn(),
    requireUserClientMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
  }));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
  requireUserClient: requireUserClientMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

async function loadGetHandler() {
  const routeModule = await import("./route");
  return routeModule.GET;
}

describe("GET /api/v1/threads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
  });

  it("returns 401 when unauthorized", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const GET = await loadGetHandler();

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it("returns 401 when authenticateRequest throws", async () => {
    authenticateRequestMock.mockRejectedValue(new Error("auth transport down"));
    const GET = await loadGetHandler();

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it("returns threads for authenticated user", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          openai_thread_id: "thread_1",
          created_at: "2026-04-05T00:00:00.000Z",
          user_id: "user-1",
          able_english: true,
          has_image: false,
          raw_text: "internal story context",
        },
      ],
      error: null,
    });

    const keywordsInMock = vi.fn().mockResolvedValue({
      data: [{ thread_id: 1, keyword: "용기" }],
      error: null,
    });
    const keywordsSelectMock = vi.fn().mockReturnValue({
      in: keywordsInMock,
    });

    const fromMock = vi.fn(table => {
      if (table === "keywords") {
        return { select: keywordsSelectMock };
      }
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-source")).toBe("rpc");
    expect(response.headers.get("x-hodam-threads-degraded")).toBeNull();
    expect(requireUserClientMock).toHaveBeenCalledWith("token-1");
    expect(rpcMock).toHaveBeenCalledWith("get_my_threads");
    expect(fromMock).toHaveBeenCalledWith("keywords");
    expect(keywordsInMock).toHaveBeenCalledWith("thread_id", [1]);
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].keywords).toEqual([{ keyword: "용기" }]);
    expect(body.threads[0].raw_text).toBeUndefined();
    expect(body.threads[0].user).toEqual({
      id: "user-1",
      email: "user1@example.com",
      display_name: "user1@example.com",
    });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });
    checkRateLimitMock.mockReturnValue(false);

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Too many thread list requests",
      code: "THREAD_LIST_RATE_LIMITED",
    });
  });

  it("falls back to direct thread query when rpc fails", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "db failed" },
    });

    const keywordsInMock = vi.fn().mockResolvedValue({
      data: [{ thread_id: 22, keyword: "모험" }],
      error: null,
    });
    const keywordsSelectMock = vi.fn().mockReturnValue({
      in: keywordsInMock,
    });
    const threadOrderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 22,
          openai_thread_id: "thread_22",
          created_at: "2026-04-05T01:00:00.000Z",
          user_id: "user-1",
          able_english: false,
          has_image: true,
        },
      ],
      error: null,
    });
    const threadEqMock = vi.fn().mockReturnValue({
      order: threadOrderMock,
    });
    const threadSelectMock = vi.fn().mockReturnValue({
      eq: threadEqMock,
    });
    const fromMock = vi.fn(table => {
      if (table === "keywords") return { select: keywordsSelectMock };
      if (table === "thread") return { select: threadSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-source")).toBe("fallback");
    expect(response.headers.get("x-hodam-threads-degraded")).toBe("1");
    expect(response.headers.get("x-hodam-threads-degraded-reasons")).toContain(
      "rpc_error",
    );
    expect(fromMock).toHaveBeenCalledWith("thread");
    expect(threadSelectMock).toHaveBeenCalledWith(
      "id, openai_thread_id, created_at, user_id, able_english, has_image",
    );
    expect(threadEqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(threadOrderMock).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].id).toBe(22);
    expect(body.threads[0].keywords).toEqual([{ keyword: "모험" }]);
  });

  it("returns empty thread list with degradation headers when rpc and fallback query fail", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
    });
    const threadOrderMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "select failed" },
    });
    const threadEqMock = vi.fn().mockReturnValue({
      order: threadOrderMock,
    });
    const threadSelectMock = vi.fn().mockReturnValue({
      eq: threadEqMock,
    });
    const fromMock = vi.fn(table => {
      if (table === "thread") return { select: threadSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-source")).toBe("none");
    expect(response.headers.get("x-hodam-threads-degraded")).toBe("1");
    expect(response.headers.get("x-hodam-threads-degraded-reasons")).toContain(
      "rpc_error",
    );
    expect(response.headers.get("x-hodam-threads-degraded-reasons")).toContain(
      "fallback_error",
    );
    expect(body).toEqual({ threads: [] });
  });

  it("returns degraded empty list when client creation throws", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    requireUserClientMock.mockImplementation(() => {
      throw new Error("client init failed");
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-source")).toBe("none");
    expect(response.headers.get("x-hodam-threads-degraded")).toBe("1");
    expect(response.headers.get("x-hodam-threads-degraded-reasons")).toContain(
      "unexpected_exception",
    );
    expect(body).toEqual({ threads: [] });
  });

  it("returns empty thread list when rpc and fallback both throw", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockRejectedValue(new Error("rpc exploded"));
    const threadOrderMock = vi
      .fn()
      .mockRejectedValue(new Error("fallback exploded"));
    const threadEqMock = vi.fn().mockReturnValue({
      order: threadOrderMock,
    });
    const threadSelectMock = vi.fn().mockReturnValue({
      eq: threadEqMock,
    });
    const fromMock = vi.fn(table => {
      if (table === "thread") return { select: threadSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-source")).toBe("none");
    expect(response.headers.get("x-hodam-threads-degraded")).toBe("1");
    expect(response.headers.get("x-hodam-threads-degraded-reasons")).toContain(
      "rpc_exception",
    );
    expect(response.headers.get("x-hodam-threads-degraded-reasons")).toContain(
      "fallback_exception",
    );
    expect(body).toEqual({ threads: [] });
  });

  it("returns threads even when keywords query fails", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          openai_thread_id: "thread_1",
          created_at: "2026-04-05T00:00:00.000Z",
          user_id: "user-1",
          able_english: true,
          has_image: false,
        },
      ],
      error: null,
    });

    const keywordsInMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "keywords failed" },
    });
    const keywordsSelectMock = vi.fn().mockReturnValue({
      in: keywordsInMock,
    });

    const fromMock = vi.fn(table => {
      if (table === "keywords") return { select: keywordsSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].keywords).toEqual([]);
  });

  it("returns threads when keywords lookup throws", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          openai_thread_id: "thread_1",
          created_at: "2026-04-05T00:00:00.000Z",
          user_id: "user-1",
          able_english: true,
          has_image: false,
        },
      ],
      error: null,
    });

    const keywordsInMock = vi
      .fn()
      .mockRejectedValue(new Error("keywords exploded"));
    const keywordsSelectMock = vi.fn().mockReturnValue({
      in: keywordsInMock,
    });

    const fromMock = vi.fn(table => {
      if (table === "keywords") return { select: keywordsSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].keywords).toEqual([]);
  });

  it("queries keywords in batches to avoid oversized in-clause requests", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: Array.from({ length: 205 }, (_, index) => ({
        id: index + 1,
        openai_thread_id: `thread_${index + 1}`,
        created_at: "2026-04-05T00:00:00.000Z",
        user_id: "user-1",
        able_english: false,
        has_image: false,
      })),
      error: null,
    });

    const keywordsInMock = vi.fn().mockResolvedValue({
      data: [{ thread_id: 1, keyword: "배치" }],
      error: null,
    });
    const keywordsSelectMock = vi.fn().mockReturnValue({
      in: keywordsInMock,
    });
    const fromMock = vi.fn(table => {
      if (table === "keywords") return { select: keywordsSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(keywordsInMock).toHaveBeenCalledTimes(3);
    expect(body.threads).toHaveLength(205);
  });

  it("drops malformed thread rows instead of failing the request", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        null,
        {
          id: "not-a-number",
          openai_thread_id: "thread_bad",
        },
        {
          id: 101,
          openai_thread_id: "thread_101",
          created_at: "2026-04-05T00:00:00.000Z",
          user_id: "user-1",
          able_english: true,
          has_image: false,
        },
      ],
      error: null,
    });
    const keywordsInMock = vi.fn().mockResolvedValue({
      data: [{ thread_id: 101, keyword: "정상" }],
      error: null,
    });
    const keywordsSelectMock = vi.fn().mockReturnValue({
      in: keywordsInMock,
    });
    const fromMock = vi.fn(table => {
      if (table === "keywords") return { select: keywordsSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-degraded")).toBe("1");
    expect(response.headers.get("x-hodam-threads-degraded-reasons")).toContain(
      "invalid_thread_rows",
    );
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].id).toBe(101);
    expect(body.threads[0].keywords).toEqual([{ keyword: "정상" }]);
  });

  it("drops malformed keyword rows and continues with valid rows", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          openai_thread_id: "thread_1",
          created_at: "2026-04-05T00:00:00.000Z",
          user_id: "user-1",
          able_english: true,
          has_image: false,
        },
      ],
      error: null,
    });
    const keywordsInMock = vi.fn().mockResolvedValue({
      data: [
        null,
        { thread_id: "x", keyword: "잘못됨" },
        { thread_id: 1, keyword: 1 },
        { thread_id: 1, keyword: "정상키워드" },
      ],
      error: null,
    });
    const keywordsSelectMock = vi.fn().mockReturnValue({
      in: keywordsInMock,
    });
    const fromMock = vi.fn(table => {
      if (table === "keywords") return { select: keywordsSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      rpc: rpcMock,
      from: fromMock,
    });

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-degraded")).toBe("1");
    expect(response.headers.get("x-hodam-threads-degraded-reasons")).toContain(
      "keywords_invalid_row",
    );
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].keywords).toEqual([{ keyword: "정상키워드" }]);
  });
});
