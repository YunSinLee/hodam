// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useAuthCallbackController from "@/app/auth/callback/useAuthCallbackController";
import { savePostLoginRedirectPath } from "@/lib/auth/post-login-redirect";
import useUserInfo, { defaultState } from "@/services/hooks/use-user-info";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  unsubscribe: vi.fn(),
  emitMetric: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/app/utils/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: mocks.unsubscribe } },
      }),
    },
  },
}));
vi.mock("@/app/auth/callback/auth-callback-metrics", () => ({
  createAuthCallbackMetricEmitter: () => mocks.emitMetric,
  fetchAuthCallbackRecentMetrics: vi.fn().mockResolvedValue(null),
  appendFetchedAuthCallbackMetrics: vi.fn(),
}));

describe("OAuth callback controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.sessionStorage.clear();
    window.localStorage.clear();
    useUserInfo.setState({
      userInfo: defaultState,
      isAuthReady: false,
      hasHydrated: false,
    });
    savePostLoginRedirectPath("/my-story/753");
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([
    ["access_denied", "Login cancelled", "access_denied"],
    ["invalid_request", "Please try again", "invalid_request"],
    ["unknown_provider_error", "OAuth state has expired", "expired_code"],
  ])(
    "retains the terminal error description and retries with %s recovery",
    (error, description, recoveryCode) => {
      const query = new URLSearchParams({
        error,
        error_description: description,
      });
      window.history.replaceState({}, "", `/auth/callback?${query}`);

      const { result } = renderHook(() => useAuthCallbackController());

      expect(result.current.state.status).toBe("error");
      expect(result.current.state.message).toBe(
        `OAuth 로그인 오류: ${description}`,
      );
      expect(result.current.state.recoveryCode).toBe(recoveryCode);
      expect(mocks.getSession).not.toHaveBeenCalled();
      expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
      act(() => {
        result.current.handlers.onRetryClick(result.current.state.recoveryCode);
      });
      expect(mocks.router.push).toHaveBeenCalledWith(
        `/sign-in?auth_error=${recoveryCode}&next=%2Fmy-story%2F753`,
      );
    },
  );

  it("still exchanges a valid code and returns to the saved book", async () => {
    window.history.replaceState({}, "", "/auth/callback?code=fresh-test-code");
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "reader-1",
            email: "reader@example.com",
            user_metadata: {},
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useAuthCallbackController());
    await act(async () => {});

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith(
      "fresh-test-code",
    );
    expect(result.current.state.status).toBe("success");
    expect(result.current.state.message).toBe(
      "로그인 성공! 작성하던 화면으로 돌아갑니다...",
    );
    expect(useUserInfo.getState().userInfo.id).toBe("reader-1");
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(
      "/my-story/753",
    );
    expect(window.sessionStorage.getItem("hodam:post-login-next")).toBeNull();
  });
});
