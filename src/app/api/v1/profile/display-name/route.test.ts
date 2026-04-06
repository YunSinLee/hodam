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

async function loadPostHandler() {
  const routeModule = await import("./route");
  return routeModule.POST;
}

describe("POST /api/v1/profile/display-name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
  });

  it("returns 401 when unauthorized", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const POST = await loadPostHandler();

    const response = await POST({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when displayName is missing", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ displayName: " " }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "displayName is required" });
  });

  it("returns 400 when body is invalid json", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockRejectedValue(new Error("invalid json")),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    checkRateLimitMock.mockReturnValue(false);
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ displayName: "정상닉네임" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many display name update requests" });
  });

  it("returns 400 when displayName length is invalid", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ displayName: "a" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "displayName must be between 2 and 30 characters",
    });
  });

  it("returns 400 when displayName contains unsupported characters", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ displayName: "닉네임\n테스트" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "displayName contains unsupported characters",
    });
  });

  it("updates display name and returns success", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ update: updateMock });
    requireUserClientMock.mockReturnValue({ from: fromMock });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ displayName: "  새로운닉네임  " }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireUserClientMock).toHaveBeenCalledWith("token-1");
    expect(fromMock).toHaveBeenCalledWith("users");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: "새로운닉네임",
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "user-1");
    expect(body).toEqual({ success: true });
  });

  it("returns 500 when update fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const eqMock = vi.fn().mockResolvedValue({
      error: { message: "db error" },
    });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ update: updateMock });
    requireUserClientMock.mockReturnValue({ from: fromMock });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ displayName: "정상닉네임" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to update display name" });
  });
});
