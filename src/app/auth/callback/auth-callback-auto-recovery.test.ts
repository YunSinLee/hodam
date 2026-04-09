import { describe, expect, it, vi } from "vitest";

import {
  getAuthCallbackAutoRecoveryNotice,
  scheduleAuthCallbackRecoveryRedirect,
} from "@/app/auth/callback/auth-callback-auto-recovery";

describe("auth-callback-auto-recovery", () => {
  it("formats auto recovery notice from delay", () => {
    expect(getAuthCallbackAutoRecoveryNotice(5000)).toBe(
      "응답 지연으로 5초 후 로그인 페이지로 이동합니다.",
    );
  });

  it("schedules redirect to sign-in with encoded auth_error", () => {
    vi.useFakeTimers();
    const replace = vi.fn();
    const cancel = scheduleAuthCallbackRecoveryRedirect({
      router: { replace },
      recoveryCode: "callback failed",
      delayMs: 1200,
    });

    expect(replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1199);
    expect(replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(replace).toHaveBeenCalledWith(
      "/sign-in?auth_error=callback%20failed",
    );

    cancel();
    vi.useRealTimers();
  });

  it("cancels scheduled redirect when cleanup is invoked", () => {
    vi.useFakeTimers();
    const replace = vi.fn();
    const cancel = scheduleAuthCallbackRecoveryRedirect({
      router: { replace },
      recoveryCode: "timeout",
      delayMs: 800,
    });

    cancel();
    vi.advanceTimersByTime(1000);
    expect(replace).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
