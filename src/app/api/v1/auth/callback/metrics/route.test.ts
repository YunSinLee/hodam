import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkRateLimitMock,
  logInfoMock,
  createSupabaseAdminClientMock,
  createSupabaseAnonServerClientMock,
  trackActivityMock,
  rpcRecordMetricMock,
} = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
  logInfoMock: vi.fn(),
  createSupabaseAdminClientMock: vi.fn(),
  createSupabaseAnonServerClientMock: vi.fn(),
  trackActivityMock: vi.fn(),
  rpcRecordMetricMock: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/server/logger", () => ({
  logInfo: logInfoMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
  createSupabaseAnonServerClient: createSupabaseAnonServerClientMock,
}));

vi.mock("@/lib/server/analytics", () => ({
  trackActivity: trackActivityMock,
}));

async function loadPostHandler() {
  const routeModule = await import("./route");
  return routeModule.POST;
}

describe("POST /api/v1/auth/callback/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
    createSupabaseAdminClientMock.mockReturnValue({} as never);
    createSupabaseAnonServerClientMock.mockReturnValue({
      rpc: rpcRecordMetricMock,
    });
    trackActivityMock.mockResolvedValue(undefined);
    rpcRecordMetricMock.mockResolvedValue({
      data: true,
      error: null,
    });
  });

  it("accepts valid diagnostics metric payload", async () => {
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "x-forwarded-for": "127.0.0.1",
      }),
      json: vi.fn().mockResolvedValue({
        stage: "exchange_start",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
        details: {
          hasCode: true,
          retryCount: 0,
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true });
    expect(trackActivityMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "auth_callback_event",
        details: expect.objectContaining({
          stage: "exchange_start",
          callbackPath: "/auth/callback",
        }),
      }),
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      "/api/v1/auth/callback/metrics",
      expect.objectContaining({
        stage: "exchange_start",
        callbackPath: "/auth/callback",
        persistedSource: "admin",
        details: {
          hasCode: true,
          retryCount: 0,
        },
      }),
    );
  });

  it("maps callback success stage into auth_callback_success action", async () => {
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "x-forwarded-for": "127.0.0.1",
      }),
      json: vi.fn().mockResolvedValue({
        stage: "callback_success",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
        details: {},
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true });
    expect(trackActivityMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "auth_callback_success",
      }),
    );
  });

  it("normalizes provider details to known provider values", async () => {
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "x-forwarded-for": "127.0.0.1",
      }),
      json: vi.fn().mockResolvedValue({
        stage: "callback_success",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
        details: {
          provider: "GoOgLe",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true });
    expect(trackActivityMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        details: expect.objectContaining({
          provider: "google",
        }),
      }),
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      "/api/v1/auth/callback/metrics",
      expect.objectContaining({
        details: {
          provider: "google",
        },
      }),
    );
  });

  it("keeps oauth attempt id detail for correlation", async () => {
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "x-forwarded-for": "127.0.0.1",
      }),
      json: vi.fn().mockResolvedValue({
        stage: "flow_start",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
        details: {
          provider: "kakao",
          oauthAttemptId: "attempt-123",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true });
    expect(trackActivityMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        details: expect.objectContaining({
          provider: "kakao",
          oauthAttemptId: "attempt-123",
        }),
      }),
    );
  });

  it("drops provider details when provider value is unsupported", async () => {
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "x-forwarded-for": "127.0.0.1",
      }),
      json: vi.fn().mockResolvedValue({
        stage: "callback_error",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
        details: {
          provider: "github",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true });
    expect(trackActivityMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        details: expect.not.objectContaining({
          provider: expect.anything(),
        }),
      }),
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      "/api/v1/auth/callback/metrics",
      expect.objectContaining({
        details: {},
      }),
    );
  });

  it("maps callback error stage into auth_callback_error action", async () => {
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "x-forwarded-for": "127.0.0.1",
      }),
      json: vi.fn().mockResolvedValue({
        stage: "callback_error",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
        details: {},
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true });
    expect(trackActivityMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "auth_callback_error",
      }),
    );
  });

  it("still returns 200 when admin client creation fails", async () => {
    createSupabaseAdminClientMock.mockImplementation(() => {
      throw new Error("missing service role");
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "x-forwarded-for": "127.0.0.1",
      }),
      json: vi.fn().mockResolvedValue({
        stage: "callback_success",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true });
    expect(trackActivityMock).not.toHaveBeenCalled();
    expect(rpcRecordMetricMock).toHaveBeenCalledWith(
      "record_auth_callback_metric",
      expect.objectContaining({
        p_stage: "callback_success",
        p_callback_path: "/auth/callback",
      }),
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      "/api/v1/auth/callback/metrics",
      expect.objectContaining({
        persistedSource: "rpc",
      }),
    );
  });

  it("uses rpc fallback when trackActivity throws", async () => {
    trackActivityMock.mockRejectedValue(new Error("insert failed"));
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers({
        "x-forwarded-for": "127.0.0.1",
      }),
      json: vi.fn().mockResolvedValue({
        stage: "flow_start",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
        details: {
          oauthAttemptId: "attempt-123",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true });
    expect(rpcRecordMetricMock).toHaveBeenCalledWith(
      "record_auth_callback_metric",
      expect.objectContaining({
        p_stage: "flow_start",
        p_callback_path: "/auth/callback",
        p_details: expect.objectContaining({
          oauthAttemptId: "attempt-123",
        }),
      }),
    );
  });

  it("returns 429 when rate limit is exceeded", async () => {
    checkRateLimitMock.mockReturnValue(false);
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({}),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Too many auth callback diagnostics requests",
      code: "AUTH_CALLBACK_METRICS_RATE_LIMITED",
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockRejectedValue(new Error("invalid json")),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid JSON body",
      code: "REQUEST_JSON_INVALID",
    });
  });

  it("returns 400 for invalid stage", async () => {
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        stage: "unknown_stage",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid auth callback metric stage",
      code: "AUTH_CALLBACK_METRIC_STAGE_INVALID",
    });
  });

  it("returns 400 for invalid timestamp", async () => {
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        stage: "flow_start",
        callbackPath: "/auth/callback",
        timestampMs: "bad",
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid auth callback metric timestamp",
      code: "AUTH_CALLBACK_METRIC_TIMESTAMP_INVALID",
    });
  });
});
