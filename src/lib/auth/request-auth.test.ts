import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, logErrorMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonServerClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
  createSupabaseUserServerClient: vi.fn((accessToken: string) => ({
    __token: accessToken,
  })),
}));

vi.mock("@/lib/server/logger", () => ({
  logError: logErrorMock,
}));

async function loadModule() {
  return import("./request-auth");
}

function makeRequest(authorization?: string) {
  return new NextRequest("http://localhost:3000/api/v1/threads", {
    headers: authorization ? { Authorization: authorization } : {},
  });
}

describe("authenticateRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when Authorization header is missing", async () => {
    const { authenticateRequest } = await loadModule();

    const result = await authenticateRequest(makeRequest());

    expect(result).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("returns null for non-bearer Authorization header", async () => {
    const { authenticateRequest } = await loadModule();

    const result = await authenticateRequest(makeRequest("Basic abc123"));

    expect(result).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("accepts bearer scheme regardless of case", async () => {
    const { authenticateRequest } = await loadModule();
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
      error: null,
    });

    const result = await authenticateRequest(makeRequest("bearer token-123"));

    expect(getUserMock).toHaveBeenCalledWith("token-123");
    expect(result).toEqual({
      accessToken: "token-123",
      userId: "user-1",
      email: "user@example.com",
    });
  });

  it("returns null when Supabase returns auth error", async () => {
    const { authenticateRequest } = await loadModule();
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });

    const result = await authenticateRequest(makeRequest("Bearer invalid"));

    expect(result).toBeNull();
  });

  it("fails closed and logs when getUser throws", async () => {
    const { authenticateRequest } = await loadModule();
    const thrownError = new Error("network down");
    getUserMock.mockRejectedValue(thrownError);

    const result = await authenticateRequest(makeRequest("Bearer token-1"));

    expect(result).toBeNull();
    expect(logErrorMock).toHaveBeenCalledWith(
      "authenticateRequest",
      thrownError,
    );
  });
});
