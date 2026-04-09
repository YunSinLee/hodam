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

function buildRequest(url: string) {
  return {
    headers: new Headers(),
    nextUrl: new URL(url),
  } as never;
}

describe("GET /api/v1/analytics/kpi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
  });

  it("returns 401 when unauthorized", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const GET = await loadGetHandler();

    const response = await GET(
      buildRequest("http://localhost:3000/api/v1/analytics/kpi"),
    );
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

    const response = await GET(
      buildRequest("http://localhost:3000/api/v1/analytics/kpi"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    checkRateLimitMock.mockReturnValue(false);
    const GET = await loadGetHandler();

    const response = await GET(
      buildRequest("http://localhost:3000/api/v1/analytics/kpi"),
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Too many KPI requests",
      code: "KPI_RATE_LIMITED",
    });
  });

  it("returns KPI payload for authenticated user", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const dailyLimitMock = vi.fn().mockResolvedValue({
      data: [
        {
          metric_date: "2026-04-06",
          create_success: 3,
          auth_callback_success: 5,
          auth_callback_error: 1,
        },
      ],
      error: null,
    });
    const dailyOrderMock = vi.fn().mockReturnValue({
      limit: dailyLimitMock,
    });
    const dailySelectMock = vi.fn().mockReturnValue({
      order: dailyOrderMock,
    });

    const retentionLimitMock = vi.fn().mockResolvedValue({
      data: [{ cohort_date: "2026-04-05", d1_retention_rate: 0.4 }],
      error: null,
    });
    const retentionOrderMock = vi.fn().mockReturnValue({
      limit: retentionLimitMock,
    });
    const retentionSelectMock = vi.fn().mockReturnValue({
      order: retentionOrderMock,
    });

    const userRetentionLimitMock = vi.fn().mockResolvedValue({
      data: [{ user_id: "user-1", retained_d1: true, retained_d7: false }],
      error: null,
    });
    const userRetentionEqMock = vi.fn().mockReturnValue({
      limit: userRetentionLimitMock,
    });
    const userRetentionSelectMock = vi.fn().mockReturnValue({
      eq: userRetentionEqMock,
    });

    const fromMock = vi.fn(table => {
      if (table === "kpi_daily") return { select: dailySelectMock };
      if (table === "kpi_retention_daily")
        return { select: retentionSelectMock };
      if (table === "kpi_user_retention")
        return { select: userRetentionSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      from: fromMock,
    });

    const GET = await loadGetHandler();
    const response = await GET(
      buildRequest("http://localhost:3000/api/v1/analytics/kpi?days=7"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireUserClientMock).toHaveBeenCalledWith("token-1");
    expect(dailyOrderMock).toHaveBeenCalledWith("metric_date", {
      ascending: false,
    });
    expect(dailyLimitMock).toHaveBeenCalledWith(7);
    expect(retentionOrderMock).toHaveBeenCalledWith("cohort_date", {
      ascending: false,
    });
    expect(retentionLimitMock).toHaveBeenCalledWith(7);
    expect(userRetentionEqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(userRetentionLimitMock).toHaveBeenCalledWith(1);
    expect(body).toEqual({
      days: 7,
      daily: [
        {
          metric_date: "2026-04-06",
          create_success: 3,
          auth_callback_success: 5,
          auth_callback_error: 1,
        },
      ],
      retentionDaily: [{ cohort_date: "2026-04-05", d1_retention_rate: 0.4 }],
      userRetention: {
        user_id: "user-1",
        retained_d1: true,
        retained_d7: false,
      },
    });
  });

  it("falls back to default days when query is invalid", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const limitMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const fromMock = vi.fn(table => {
      if (table === "kpi_user_retention") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({ limit: limitMock }),
        }),
      };
    });

    requireUserClientMock.mockReturnValue({ from: fromMock });
    const GET = await loadGetHandler();

    const response = await GET(
      buildRequest("http://localhost:3000/api/v1/analytics/kpi?days=abc"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.days).toBe(14);
    expect(limitMock).toHaveBeenNthCalledWith(1, 14);
    expect(limitMock).toHaveBeenNthCalledWith(2, 14);
  });

  it("returns degraded headers when one KPI view query fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const dailySelectMock = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "relation does not exist" },
        }),
      }),
    });
    const retentionSelectMock = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    const userSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    requireUserClientMock.mockReturnValue({
      from: vi.fn(table => {
        if (table === "kpi_daily") return { select: dailySelectMock };
        if (table === "kpi_retention_daily")
          return { select: retentionSelectMock };
        return { select: userSelectMock };
      }),
    });

    const GET = await loadGetHandler();
    const response = await GET(
      buildRequest("http://localhost:3000/api/v1/analytics/kpi"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-hodam-kpi-degraded")).toBe("1");
    expect(response.headers.get("x-hodam-kpi-degraded-reasons")).toContain(
      "kpi_daily_error",
    );
    expect(body.daily).toEqual([]);
  });

  it("returns 500 when user client creation throws", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    requireUserClientMock.mockImplementation(() => {
      throw new Error("client init failed");
    });

    const GET = await loadGetHandler();
    const response = await GET(
      buildRequest("http://localhost:3000/api/v1/analytics/kpi"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to fetch KPI metrics",
      code: "KPI_FETCH_FAILED",
    });
  });
});
