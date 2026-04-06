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

describe("GET /api/v1/profile/summary", () => {
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
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when access token cannot resolve user", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    requireUserClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "invalid token" },
        }),
      },
      from: vi.fn(),
    });

    const GET = await loadGetHandler();
    const response = await GET({
      headers: new Headers(),
      nextUrl: new URL("http://localhost/api/v1/profile/summary"),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    checkRateLimitMock.mockReturnValue(false);

    const GET = await loadGetHandler();
    const response = await GET({
      headers: new Headers(),
      nextUrl: new URL("http://localhost/api/v1/profile/summary"),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many profile summary requests" });
  });

  it("returns profile summary for authenticated user", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const usersMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        display_name: "테스트유저",
        custom_profile_url: "https://cdn.example.com/avatar.png",
      },
      error: null,
    });
    const usersEqMock = vi.fn().mockReturnValue({
      maybeSingle: usersMaybeSingleMock,
    });
    const usersSelectMock = vi.fn().mockReturnValue({ eq: usersEqMock });

    const threadIdEqMock = vi.fn().mockResolvedValue({
      data: [{ id: 10 }],
      error: null,
    });
    const threadRecentLimitMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 10,
          created_at: "2026-04-05T00:00:00.000Z",
          able_english: true,
          has_image: false,
        },
      ],
      error: null,
    });
    const threadRecentOrderMock = vi
      .fn()
      .mockReturnValue({ limit: threadRecentLimitMock });
    const threadRecentEqMock = vi
      .fn()
      .mockReturnValue({ order: threadRecentOrderMock });
    const threadSelectMock = vi.fn((columns: string) => {
      if (columns === "id") {
        return { eq: threadIdEqMock };
      }
      return { eq: threadRecentEqMock };
    });

    const paymentEqStatusMock = vi.fn().mockResolvedValue({
      data: [{ bead_quantity: 20, amount: 10000 }],
      error: null,
    });
    const paymentEqUserMock = vi
      .fn()
      .mockReturnValue({ eq: paymentEqStatusMock });
    const paymentSelectMock = vi
      .fn()
      .mockReturnValue({ eq: paymentEqUserMock });

    const messagesInMock = vi.fn().mockResolvedValue({
      count: 3,
      error: null,
    });
    const messagesSelectMock = vi.fn().mockReturnValue({ in: messagesInMock });

    const keywordsInMock = vi.fn().mockResolvedValue({
      data: [{ thread_id: 10, keyword: "용기" }],
      error: null,
    });
    const keywordsSelectMock = vi.fn().mockReturnValue({ in: keywordsInMock });

    const fromMock = vi.fn((table: string) => {
      if (table === "users") return { select: usersSelectMock };
      if (table === "thread") return { select: threadSelectMock };
      if (table === "payment_history") return { select: paymentSelectMock };
      if (table === "messages") return { select: messagesSelectMock };
      if (table === "keywords") return { select: keywordsSelectMock };
      return { select: vi.fn() };
    });

    requireUserClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              created_at: "2026-01-01T00:00:00.000Z",
              user_metadata: { name: "테스트유저" },
            },
          },
          error: null,
        }),
      },
      from: fromMock,
    });

    const GET = await loadGetHandler();
    const response = await GET({
      headers: new Headers(),
      nextUrl: new URL("http://localhost/api/v1/profile/summary?limit=5"),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireUserClientMock).toHaveBeenCalledWith("token-1");
    expect(body.profile).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      display_name: "테스트유저",
      totalStories: 1,
      totalBeadsPurchased: 20,
      totalBeadsUsed: 3,
    });
    expect(body.stats).toMatchObject({
      totalStories: 1,
      totalBeadsPurchased: 20,
      totalBeadsUsed: 3,
      totalPaymentAmount: 10000,
    });
    expect(body.recentStories).toEqual([
      expect.objectContaining({
        id: 10,
        keywords: [{ keyword: "용기" }],
      }),
    ]);
  });

  it("returns 500 when summary query fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const usersMaybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "db error" },
    });
    const usersEqMock = vi.fn().mockReturnValue({
      maybeSingle: usersMaybeSingleMock,
    });
    const usersSelectMock = vi.fn().mockReturnValue({ eq: usersEqMock });

    requireUserClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              created_at: "2026-01-01T00:00:00.000Z",
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ select: usersSelectMock }),
    });

    const GET = await loadGetHandler();
    const response = await GET({
      headers: new Headers(),
      nextUrl: new URL("http://localhost/api/v1/profile/summary"),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch profile summary" });
  });
});
