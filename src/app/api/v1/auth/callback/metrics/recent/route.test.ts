import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkRateLimitMock,
  logErrorMock,
  logInfoMock,
  createSupabaseAnonServerClientMock,
  createSupabaseAdminClientMock,
  rpcRecentMetricsMock,
  queryLimitMock,
  queryOrderMock,
  queryEqMock,
  querySelectMock,
  queryFromMock,
} = vi.hoisted(() => {
  const rpcRecentMetrics = vi.fn();
  const queryLimit = vi.fn();
  const queryOrder = vi.fn(() => ({
    limit: queryLimit,
  }));
  const queryEq = vi.fn(() => ({
    order: queryOrder,
  }));
  const queryIn = vi.fn(() => ({
    eq: queryEq,
  }));
  const queryGte = vi.fn(() => ({
    in: queryIn,
  }));
  const querySelect = vi.fn(() => ({
    gte: queryGte,
  }));
  const queryFrom = vi.fn(() => ({
    select: querySelect,
  }));

  return {
    checkRateLimitMock: vi.fn(),
    logErrorMock: vi.fn(),
    logInfoMock: vi.fn(),
    createSupabaseAnonServerClientMock: vi.fn(() => ({
      rpc: rpcRecentMetrics,
    })),
    createSupabaseAdminClientMock: vi.fn(() => ({
      from: queryFrom,
    })),
    rpcRecentMetricsMock: rpcRecentMetrics,
    queryLimitMock: queryLimit,
    queryOrderMock: queryOrder,
    queryEqMock: queryEq,
    querySelectMock: querySelect,
    queryFromMock: queryFrom,
  };
});

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/server/logger", () => ({
  logError: logErrorMock,
  logInfo: logInfoMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonServerClient: createSupabaseAnonServerClientMock,
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

async function loadGetHandler() {
  const routeModule = await import("./route");
  return routeModule.GET;
}

function makeRequest(
  query = "attemptId=attempt-123",
  headers: Headers = new Headers({
    "x-forwarded-for": "127.0.0.1",
  }),
) {
  return {
    headers,
    url: `http://localhost:3000/api/v1/auth/callback/metrics/recent?${query}`,
  } as never;
}

describe("GET /api/v1/auth/callback/metrics/recent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
    createSupabaseAnonServerClientMock.mockImplementation(() => ({
      rpc: rpcRecentMetricsMock,
    }));
    createSupabaseAdminClientMock.mockImplementation(() => ({
      from: queryFromMock,
    }));
    rpcRecentMetricsMock.mockResolvedValue({
      data: [],
      error: null,
    });
    queryLimitMock.mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    checkRateLimitMock.mockReturnValue(false);
    const GET = await loadGetHandler();

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Too many auth callback diagnostics requests",
      code: "AUTH_CALLBACK_METRICS_RATE_LIMITED",
    });
  });

  it("returns 400 when attempt id is missing", async () => {
    const GET = await loadGetHandler();

    const response = await GET(makeRequest(""));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid auth callback attempt id",
      code: "AUTH_CALLBACK_ATTEMPT_ID_INVALID",
    });
  });

  it("returns 400 when attempt id format is invalid", async () => {
    const GET = await loadGetHandler();

    const response = await GET(makeRequest("attemptId=bad value"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid auth callback attempt id",
      code: "AUTH_CALLBACK_ATTEMPT_ID_INVALID",
    });
  });

  it("returns normalized metrics from rpc", async () => {
    rpcRecentMetricsMock.mockResolvedValue({
      data: [
        {
          action: "auth_callback_success",
          created_at: "2026-04-07T00:00:05.000Z",
          details: {
            stage: "callback_success",
            callbackPath: "/auth/callback",
            timestampMs: 1712419205000,
            provider: "GoOgLe",
            oauthAttemptId: "attempt-123",
            nested: { ignored: true },
          },
        },
        {
          action: "auth_callback_event",
          created_at: "2026-04-07T00:00:01.000Z",
          details: {
            stage: "flow_start",
            callbackPath: "/auth/callback",
            timestampMs: 1712419201000,
            provider: "kakao",
            oauthAttemptId: "attempt-123",
          },
        },
      ],
      error: null,
    });
    const GET = await loadGetHandler();

    const response = await GET(makeRequest("attemptId=attempt-123&limit=5"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      attemptId: "attempt-123",
      events: [
        {
          stage: "flow_start",
          callbackPath: "/auth/callback",
          timestampMs: 1712419201000,
          details: {
            stage: "flow_start",
            callbackPath: "/auth/callback",
            timestampMs: 1712419201000,
            provider: "kakao",
            oauthAttemptId: "attempt-123",
          },
        },
        {
          stage: "callback_success",
          callbackPath: "/auth/callback",
          timestampMs: 1712419205000,
          details: {
            stage: "callback_success",
            callbackPath: "/auth/callback",
            timestampMs: 1712419205000,
            provider: "google",
            oauthAttemptId: "attempt-123",
          },
        },
      ],
      truncated: false,
      degraded: false,
      degradedReason: null,
    });
    expect(rpcRecentMetricsMock).toHaveBeenCalledWith(
      "get_auth_callback_metrics_by_attempt",
      {
        p_attempt_id: "attempt-123",
        p_limit: 6,
      },
    );
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("marks response as truncated when queried rows exceed limit", async () => {
    rpcRecentMetricsMock.mockResolvedValue({
      data: [
        {
          action: "auth_callback_event",
          created_at: "2026-04-07T00:00:03.000Z",
          details: {
            stage: "exchange_start",
            callbackPath: "/auth/callback",
            timestampMs: 3,
          },
        },
        {
          action: "auth_callback_event",
          created_at: "2026-04-07T00:00:02.000Z",
          details: {
            stage: "payload_parsed",
            callbackPath: "/auth/callback",
            timestampMs: 2,
          },
        },
        {
          action: "auth_callback_event",
          created_at: "2026-04-07T00:00:01.000Z",
          details: {
            stage: "flow_start",
            callbackPath: "/auth/callback",
            timestampMs: 1,
          },
        },
      ],
      error: null,
    });
    const GET = await loadGetHandler();

    const response = await GET(makeRequest("attemptId=attempt-123&limit=2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.truncated).toBe(true);
    expect(body.events).toEqual([
      expect.objectContaining({ stage: "payload_parsed" }),
      expect.objectContaining({ stage: "exchange_start" }),
    ]);
  });

  it("falls back to admin query when rpc returns error", async () => {
    rpcRecentMetricsMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "function not found",
      },
    });
    queryLimitMock.mockResolvedValue({
      data: [
        {
          action: "auth_callback_event",
          created_at: "2026-04-07T00:00:01.000Z",
          details: {
            stage: "flow_start",
            callbackPath: "/auth/callback",
            timestampMs: 1,
            oauthAttemptId: "attempt-123",
          },
        },
      ],
      error: null,
    });
    const GET = await loadGetHandler();

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.degraded).toBe(false);
    expect(body.events).toEqual([
      expect.objectContaining({
        stage: "flow_start",
      }),
    ]);
    expect(createSupabaseAdminClientMock).toHaveBeenCalledTimes(1);
    expect(queryFromMock).toHaveBeenCalledWith("user_activity_logs");
    expect(querySelectMock).toHaveBeenCalledWith("action, details, created_at");
    expect(queryEqMock).toHaveBeenCalledWith(
      "details->>oauthAttemptId",
      "attempt-123",
    );
    expect(queryOrderMock).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("returns degraded response when rpc and admin source are both unavailable", async () => {
    rpcRecentMetricsMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "function not found",
      },
    });
    createSupabaseAdminClientMock.mockImplementation(() => {
      throw new Error(
        "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
      );
    });
    const GET = await loadGetHandler();

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      attemptId: "attempt-123",
      events: [],
      truncated: false,
      degraded: true,
      degradedReason: "metrics_source_unavailable",
    });
  });

  it("returns degraded response when admin fallback query fails", async () => {
    rpcRecentMetricsMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "function not found",
      },
    });
    queryLimitMock.mockResolvedValue({
      data: null,
      error: new Error("query failed"),
    });
    const GET = await loadGetHandler();

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      attemptId: "attempt-123",
      events: [],
      truncated: false,
      degraded: true,
      degradedReason: "fetch_failed",
    });
    expect(logErrorMock).toHaveBeenCalledWith(
      "/api/v1/auth/callback/metrics/recent",
      expect.any(Error),
      expect.objectContaining({
        attemptId: "attempt-123",
      }),
    );
  });
});
