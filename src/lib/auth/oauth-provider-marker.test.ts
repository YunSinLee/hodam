import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOAuthProviderMarker,
  markOAuthProvider,
  readRecentOAuthAttemptId,
  readRecentOAuthProvider,
  readRecentOAuthProviderMarker,
} from "@/lib/auth/oauth-provider-marker";

describe("oauth-provider-marker", () => {
  const originalWindow = globalThis.window;
  const originalCrypto = globalThis.crypto;
  const dateNowSpy = vi.spyOn(Date, "now");
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dateNowSpy.mockReturnValue(1_000_000);

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: sessionStorageMock,
      },
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID: vi.fn().mockReturnValue("attempt-1"),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("stores provider marker payload in sessionStorage", () => {
    const attemptId = markOAuthProvider("kakao");

    expect(attemptId).toBe("attempt-1");
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      "hodam:oauth:provider",
      JSON.stringify({
        provider: "kakao",
        timestampMs: 1_000_000,
        attemptId: "attempt-1",
      }),
    );
  });

  it("returns provider when marker is fresh", () => {
    sessionStorageMock.getItem.mockReturnValue(
      JSON.stringify({
        provider: "google",
        timestampMs: 1_000_000,
        attemptId: "attempt-xyz",
      }),
    );

    expect(readRecentOAuthProvider()).toBe("google");
    expect(readRecentOAuthAttemptId()).toBe("attempt-xyz");
    expect(readRecentOAuthProviderMarker()).toEqual({
      provider: "google",
      timestampMs: 1_000_000,
      attemptId: "attempt-xyz",
    });
  });

  it("clears marker when marker is stale", () => {
    sessionStorageMock.getItem.mockReturnValue(
      JSON.stringify({
        provider: "kakao",
        timestampMs: 10_000,
        attemptId: "attempt-old",
      }),
    );
    dateNowSpy.mockReturnValue(1_000_000 + 1000 * 60 * 16);

    expect(readRecentOAuthProvider()).toBeNull();
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(
      "hodam:oauth:provider",
    );
  });

  it("returns null attempt id when marker payload is legacy", () => {
    sessionStorageMock.getItem.mockReturnValue(
      JSON.stringify({
        provider: "google",
        timestampMs: 1_000_000,
      }),
    );

    expect(readRecentOAuthProvider()).toBe("google");
    expect(readRecentOAuthAttemptId()).toBeNull();
  });

  it("clears marker key explicitly", () => {
    clearOAuthProviderMarker();
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(
      "hodam:oauth:provider",
    );
  });
});
