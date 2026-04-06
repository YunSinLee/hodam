import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateRequestMock,
  requireUserClientMock,
  ensureBeadRowMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
  requireUserClientMock: vi.fn(),
  ensureBeadRowMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
  requireUserClient: requireUserClientMock,
}));

vi.mock("@/lib/server/hodam-repo", () => ({
  ensureBeadRow: ensureBeadRowMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

async function loadGetHandler() {
  const routeModule = await import("./route");
  return routeModule.GET;
}

describe("GET /api/v1/beads", () => {
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

  it("returns bead info for authenticated user", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const userClient = { from: vi.fn() };
    requireUserClientMock.mockReturnValue(userClient);
    ensureBeadRowMock.mockResolvedValue({
      id: "bead-1",
      count: 10,
    });

    const GET = await loadGetHandler();
    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireUserClientMock).toHaveBeenCalledWith("token-1");
    expect(ensureBeadRowMock).toHaveBeenCalledWith(userClient, "user-1");
    expect(body).toEqual({
      bead: {
        id: "bead-1",
        user_id: "user-1",
        count: 10,
      },
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
    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many bead requests" });
  });

  it("returns 500 when repository fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    requireUserClientMock.mockReturnValue({ from: vi.fn() });
    ensureBeadRowMock.mockRejectedValue(new Error("db error"));

    const GET = await loadGetHandler();
    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch beads" });
  });
});
