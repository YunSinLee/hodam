import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateRequestMock,
  requireUserClientMock,
  getThreadForUserMock,
  getMessagesForThreadMock,
  getLatestThreadImageSignedUrlMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
  requireUserClientMock: vi.fn(),
  getThreadForUserMock: vi.fn(),
  getMessagesForThreadMock: vi.fn(),
  getLatestThreadImageSignedUrlMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
  requireUserClient: requireUserClientMock,
}));

vi.mock("@/lib/server/hodam-repo", () => ({
  getThreadForUser: getThreadForUserMock,
  getMessagesForThread: getMessagesForThreadMock,
  getLatestThreadImageSignedUrl: getLatestThreadImageSignedUrlMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

async function loadGetHandler() {
  const routeModule = await import("./route");
  return routeModule.GET;
}

function contextWithThreadId(threadId: string) {
  return {
    params: Promise.resolve({ threadId }),
  };
}

describe("GET /api/v1/threads/[threadId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
  });

  it("returns 401 when unauthorized", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const GET = await loadGetHandler();

    const response = await GET(
      { headers: new Headers() } as never,
      contextWithThreadId("1"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when threadId is invalid", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const response = await GET(
      { headers: new Headers() } as never,
      contextWithThreadId("invalid"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid threadId" });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });
    checkRateLimitMock.mockReturnValue(false);

    const response = await GET(
      { headers: new Headers() } as never,
      contextWithThreadId("1"),
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many thread detail requests" });
  });

  it("returns thread detail from rpc when available", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          thread_row: {
            id: 1,
            openai_thread_id: "thread_1",
            created_at: "2026-04-05T00:00:00.000Z",
            user_id: "user-1",
            able_english: true,
            has_image: true,
            raw_text: "story",
          },
          messages: [
            {
              id: 11,
              turn: 0,
              message: "첫 문장",
              message_en: null,
              created_at: "2026-04-05T00:00:00.000Z",
            },
          ],
          selections: [],
        },
      ],
      error: null,
    });
    const userClient = { rpc: rpcMock, from: vi.fn() };
    requireUserClientMock.mockReturnValue(userClient);
    getLatestThreadImageSignedUrlMock.mockResolvedValue(
      "https://img.example.com/thread-1.png",
    );

    const response = await GET(
      { headers: new Headers() } as never,
      contextWithThreadId("1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-source")).toBe("rpc");
    expect(response.headers.get("x-hodam-threads-degraded")).toBeNull();
    expect(requireUserClientMock).toHaveBeenCalledWith("token-1");
    expect(rpcMock).toHaveBeenCalledWith("get_thread_detail", {
      p_thread_id: 1,
    });
    expect(getThreadForUserMock).not.toHaveBeenCalled();
    expect(getMessagesForThreadMock).not.toHaveBeenCalled();
    expect(getLatestThreadImageSignedUrlMock).toHaveBeenCalledWith(
      userClient,
      "user-1",
      1,
    );
    expect(body.messages).toEqual([
      {
        id: 11,
        turn: 0,
        text: "첫 문장",
        text_en: "",
        created_at: "2026-04-05T00:00:00.000Z",
      },
    ]);
    expect(body.thread.raw_text).toBeUndefined();
    expect(body.thread.created_at).toBe("2026-04-05T00:00:00.000Z");
  });

  it("falls back to repository lookups when rpc detail query fails", async () => {
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
    const userClient = { rpc: rpcMock, from: vi.fn() };
    requireUserClientMock.mockReturnValue(userClient);

    getThreadForUserMock.mockResolvedValue({
      id: 1,
      openai_thread_id: "thread_1",
      created_at: "2026-04-05T00:00:00.000Z",
      user_id: "user-1",
      able_english: true,
      has_image: true,
      raw_text: "story",
    });
    getMessagesForThreadMock.mockResolvedValue([
      {
        id: 11,
        turn: 0,
        message: "첫 문장",
        message_en: null,
        created_at: "2026-04-05T00:00:00.000Z",
      },
    ]);
    getLatestThreadImageSignedUrlMock.mockResolvedValue(
      "https://img.example.com/thread-1.png",
    );

    const response = await GET(
      { headers: new Headers() } as never,
      contextWithThreadId("1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-source")).toBe("fallback");
    expect(response.headers.get("x-hodam-threads-degraded")).toBe("1");
    expect(
      response.headers.get("x-hodam-threads-degraded-reasons") || "",
    ).toContain("rpc_error");
    expect(rpcMock).toHaveBeenCalledWith("get_thread_detail", {
      p_thread_id: 1,
    });
    expect(getThreadForUserMock).toHaveBeenCalledWith(userClient, 1, "user-1");
    expect(getMessagesForThreadMock).toHaveBeenCalledWith(userClient, 1);
    expect(body.messages).toHaveLength(1);
    expect(body.thread.raw_text).toBeUndefined();
    expect(body.thread.openai_thread_id).toBe("thread_1");
  });

  it("marks response as fallback when rpc detail is empty", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const userClient = { rpc: rpcMock, from: vi.fn() };
    requireUserClientMock.mockReturnValue(userClient);

    getThreadForUserMock.mockResolvedValue({
      id: 1,
      openai_thread_id: "thread_1",
      created_at: "2026-04-05T00:00:00.000Z",
      user_id: "user-1",
      able_english: true,
      has_image: true,
      raw_text: "story",
    });
    getMessagesForThreadMock.mockResolvedValue([
      {
        id: 11,
        turn: 0,
        message: "첫 문장",
        message_en: null,
        created_at: "2026-04-05T00:00:00.000Z",
      },
    ]);
    getLatestThreadImageSignedUrlMock.mockResolvedValue(
      "https://img.example.com/thread-1.png",
    );

    const response = await GET(
      { headers: new Headers() } as never,
      contextWithThreadId("1"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-threads-source")).toBe("fallback");
    expect(response.headers.get("x-hodam-threads-degraded")).toBe("1");
    expect(
      response.headers.get("x-hodam-threads-degraded-reasons") || "",
    ).toContain("rpc_empty");
  });

  it("returns 404 when thread is not found", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    requireUserClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn(),
    });
    getThreadForUserMock.mockRejectedValue(new Error("THREAD_NOT_FOUND"));

    const response = await GET(
      { headers: new Headers() } as never,
      contextWithThreadId("1"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Thread not found" });
  });

  it("returns 500 on unexpected errors", async () => {
    const GET = await loadGetHandler();
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user1@example.com",
    });

    requireUserClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn(),
    });
    getThreadForUserMock.mockRejectedValue(new Error("unexpected failure"));

    const response = await GET(
      { headers: new Headers() } as never,
      contextWithThreadId("1"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch thread detail" });
  });
});
