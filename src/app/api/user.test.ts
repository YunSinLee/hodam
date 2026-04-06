import { beforeEach, describe, expect, it, vi } from "vitest";

import userApi from "@/lib/client/api/user";

const {
  signInWithOAuthMock,
  signOutMock,
  getSessionMock,
  signUpMock,
  signInWithPasswordMock,
  resolveOAuthRedirectUrlMock,
} = vi.hoisted(() => ({
  signInWithOAuthMock: vi.fn(),
  signOutMock: vi.fn(),
  getSessionMock: vi.fn(),
  signUpMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  resolveOAuthRedirectUrlMock: vi.fn(),
}));

vi.mock("@/app/utils/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: signInWithOAuthMock,
      signOut: signOutMock,
      getSession: getSessionMock,
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
    },
  },
}));

vi.mock("@/lib/auth/oauth-redirect", () => ({
  resolveOAuthRedirectUrl: resolveOAuthRedirectUrlMock,
}));

describe("userApi OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveOAuthRedirectUrlMock.mockReturnValue({
      redirectTo: "http://localhost:3000/auth/callback",
      warnings: [],
    });
  });

  it("passes redirectTo and navigates when Supabase returns redirect url", async () => {
    const assignMock = vi.fn();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          origin: "http://localhost:3000",
          assign: assignMock,
        },
      },
    });

    signInWithOAuthMock.mockResolvedValue({
      data: {
        url: "https://auth.example.com/oauth/start",
      },
      error: null,
    });

    await userApi.signInWithKakao();

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "kakao",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith(
      "https://auth.example.com/oauth/start",
    );
  });

  it("falls back to browser redirect flow when skipBrowserRedirect returns no url", async () => {
    const assignMock = vi.fn();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          origin: "http://localhost:3000",
          assign: assignMock,
        },
      },
    });

    signInWithOAuthMock
      .mockResolvedValueOnce({
        data: {},
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          url: "https://auth.example.com/oauth/fallback",
        },
        error: null,
      });

    await userApi.signInWithGoogle();

    expect(signInWithOAuthMock).toHaveBeenNthCalledWith(1, {
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(signInWithOAuthMock).toHaveBeenNthCalledWith(2, {
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
      },
    });
    expect(assignMock).toHaveBeenCalledWith(
      "https://auth.example.com/oauth/fallback",
    );
  });

  it("throws when Supabase does not return redirect url in both attempts", async () => {
    const assignMock = vi.fn();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          origin: "http://localhost:3000",
          assign: assignMock,
        },
      },
    });

    signInWithOAuthMock
      .mockResolvedValueOnce({
        data: {},
        error: null,
      })
      .mockResolvedValueOnce({
        data: {},
        error: null,
      });

    await expect(userApi.signInWithGoogle()).rejects.toThrow(
      "OAuth redirect URL을 가져오지 못했습니다.",
    );
    expect(signInWithOAuthMock).toHaveBeenCalledTimes(2);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("throws when fallback redirect request returns an error", async () => {
    const assignMock = vi.fn();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          origin: "http://localhost:3000",
          assign: assignMock,
        },
      },
    });

    signInWithOAuthMock
      .mockResolvedValueOnce({
        data: {},
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: new Error("fallback oauth failed"),
      });

    await expect(userApi.signInWithGoogle()).rejects.toThrow(
      "fallback oauth failed",
    );
    expect(signInWithOAuthMock).toHaveBeenCalledTimes(2);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("throws when primary OAuth sign-in request times out", async () => {
    vi.useFakeTimers();
    try {
      const assignMock = vi.fn();

      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: {
            origin: "http://localhost:3000",
            assign: assignMock,
          },
        },
      });

      signInWithOAuthMock.mockImplementation(
        () => new Promise(() => {}) as never,
      );

      const promise = userApi.signInWithGoogle();
      const expectation = expect(promise).rejects.toThrow(
        "OAuth sign-in request timeout",
      );
      await vi.advanceTimersByTimeAsync(12_001);
      await expectation;
      expect(assignMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when Supabase signInWithOAuth returns error", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          origin: "http://localhost:3000",
          assign: vi.fn(),
        },
      },
    });

    signInWithOAuthMock.mockResolvedValue({
      data: null,
      error: new Error("oauth failed"),
    });

    await expect(userApi.signInWithKakao()).rejects.toThrow("oauth failed");
    expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
  });

  it("throws when fallback redirect request times out", async () => {
    vi.useFakeTimers();
    try {
      const assignMock = vi.fn();

      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: {
            origin: "http://localhost:3000",
            assign: assignMock,
          },
        },
      });

      signInWithOAuthMock
        .mockResolvedValueOnce({
          data: {},
          error: null,
        })
        .mockImplementationOnce(() => new Promise(() => {}) as never);

      const promise = userApi.signInWithGoogle();
      const expectation = expect(promise).rejects.toThrow(
        "OAuth redirect request timeout",
      );
      await vi.advanceTimersByTimeAsync(12_001);
      await expectation;
      expect(assignMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
