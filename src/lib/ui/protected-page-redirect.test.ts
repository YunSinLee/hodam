import { describe, expect, it, vi } from "vitest";

import { scheduleProtectedPageSignInRedirect } from "@/lib/ui/protected-page-redirect";

describe("scheduleProtectedPageSignInRedirect", () => {
  it("redirects to encoded sign-in path after delay", () => {
    vi.useFakeTimers();
    const replace = vi.fn();
    const cleanup = scheduleProtectedPageSignInRedirect({
      router: { replace },
      returnPath: "/payment-history?orderId=ORD-123",
      delayMs: 1200,
    });

    vi.advanceTimersByTime(1199);
    expect(replace).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(replace).toHaveBeenCalledWith(
      "/sign-in?auth_error=callback_failed&next=%2Fpayment-history%3ForderId%3DORD-123",
    );

    cleanup();
    vi.useRealTimers();
  });

  it("cancels redirect when cleanup is called", () => {
    vi.useFakeTimers();
    const replace = vi.fn();
    const cleanup = scheduleProtectedPageSignInRedirect({
      router: { replace },
      returnPath: "/profile",
      delayMs: 500,
    });

    cleanup();
    vi.advanceTimersByTime(1000);
    expect(replace).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
