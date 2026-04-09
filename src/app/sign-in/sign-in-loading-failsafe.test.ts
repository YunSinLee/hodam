import { describe, expect, it, vi } from "vitest";

import {
  getSignInLoadingFailsafeMessage,
  scheduleSignInLoadingFailsafe,
  SIGN_IN_LOADING_FAILSAFE_MS,
} from "@/app/sign-in/sign-in-loading-failsafe";

describe("getSignInLoadingFailsafeMessage", () => {
  it("returns localized message for kakao", () => {
    expect(getSignInLoadingFailsafeMessage("kakao")).toContain("카카오");
  });

  it("returns localized message for google", () => {
    expect(getSignInLoadingFailsafeMessage("google")).toContain("구글");
  });
});

describe("scheduleSignInLoadingFailsafe", () => {
  it("sets loading false and emits message when timeout fires", () => {
    vi.useFakeTimers();
    const setLoading = vi.fn();
    const setErrorMessage = vi.fn();

    scheduleSignInLoadingFailsafe({
      provider: "kakao",
      setLoading,
      setErrorMessage,
      delayMs: 10,
    });

    vi.advanceTimersByTime(10);

    expect(setLoading).toHaveBeenCalledWith(false);
    expect(setErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("카카오"),
    );
    vi.useRealTimers();
  });

  it("does not fire after cleanup", () => {
    vi.useFakeTimers();
    const setLoading = vi.fn();
    const setErrorMessage = vi.fn();

    const cleanup = scheduleSignInLoadingFailsafe({
      provider: "google",
      setLoading,
      setErrorMessage,
      delayMs: 10,
    });
    cleanup();

    vi.advanceTimersByTime(10);

    expect(setLoading).not.toHaveBeenCalled();
    expect(setErrorMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("uses default fail-safe duration", () => {
    vi.useFakeTimers();
    const setLoading = vi.fn();
    const setErrorMessage = vi.fn();

    scheduleSignInLoadingFailsafe({
      provider: "google",
      setLoading,
      setErrorMessage,
    });

    vi.advanceTimersByTime(SIGN_IN_LOADING_FAILSAFE_MS - 1);
    expect(setLoading).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setLoading).toHaveBeenCalledWith(false);
    expect(setErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("구글"),
    );
    vi.useRealTimers();
  });
});
