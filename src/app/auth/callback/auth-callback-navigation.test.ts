import { describe, expect, it, vi } from "vitest";

import { scheduleAuthCallbackRedirect } from "@/app/auth/callback/auth-callback-navigation";

describe("auth-callback-navigation", () => {
  it("calls router.replace immediately", () => {
    const replace = vi.fn();
    const assign = vi.fn();

    scheduleAuthCallbackRedirect({
      router: { replace } as never,
      targetPath: "/",
      fallbackDelayMs: 1000,
      location: {
        pathname: "/auth/callback",
        search: "",
        assign,
      },
    });

    expect(replace).toHaveBeenCalledWith("/");
    expect(assign).not.toHaveBeenCalled();
  });

  it("falls back to hard reload when still on callback page", () => {
    vi.useFakeTimers();

    const replace = vi.fn();
    const assign = vi.fn();
    const location = {
      pathname: "/auth/callback",
      search: "?code=test",
      assign,
    };

    scheduleAuthCallbackRedirect({
      router: { replace } as never,
      targetPath: "/my-story",
      fallbackDelayMs: 1200,
      location,
    });

    vi.advanceTimersByTime(1200);

    expect(assign).toHaveBeenCalledWith("/my-story");
    vi.useRealTimers();
  });

  it("does not hard reload when route has already changed", () => {
    vi.useFakeTimers();

    const replace = vi.fn();
    const assign = vi.fn();
    const location = {
      pathname: "/auth/callback",
      search: "",
      assign,
    };

    scheduleAuthCallbackRedirect({
      router: { replace } as never,
      targetPath: "/profile",
      fallbackDelayMs: 900,
      location,
    });

    location.pathname = "/profile";
    vi.advanceTimersByTime(900);

    expect(assign).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
