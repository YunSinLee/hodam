import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/app/utils/supabase", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

async function loadModule() {
  return import("@/lib/auth/session-recovery");
}

describe("recoverSessionUserInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session user info when session exists", async () => {
    const { recoverSessionUserInfo } = await loadModule();
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
            email: "user@example.com",
            user_metadata: {
              avatar_url: "https://example.com/avatar.png",
            },
          },
        },
      },
      error: null,
    });

    const result = await recoverSessionUserInfo({
      maxAttempts: 1,
      retryDelayMs: 0,
    });

    expect(result).toEqual({
      id: "user-1",
      email: "user@example.com",
      profileUrl: "https://example.com/avatar.png",
    });
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it("retries when session is temporarily missing", async () => {
    const { recoverSessionUserInfo } = await loadModule();
    getSessionMock
      .mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: "user-2",
              email: "second@example.com",
              user_metadata: {},
            },
          },
        },
        error: null,
      });

    const result = await recoverSessionUserInfo({
      maxAttempts: 2,
      retryDelayMs: 0,
    });

    expect(result).toEqual({
      id: "user-2",
      email: "second@example.com",
      profileUrl: "",
    });
    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when session cannot be recovered", async () => {
    const { recoverSessionUserInfo } = await loadModule();
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: new Error("session unavailable"),
    });

    const result = await recoverSessionUserInfo({
      maxAttempts: 3,
      retryDelayMs: 0,
    });

    expect(result).toBeNull();
    expect(getSessionMock).toHaveBeenCalledTimes(3);
  });
});
