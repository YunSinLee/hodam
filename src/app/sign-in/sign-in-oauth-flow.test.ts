import { describe, expect, it, vi } from "vitest";

import { startOAuthSignInWithMarker } from "@/app/sign-in/sign-in-oauth-flow";

describe("sign-in-oauth-flow", () => {
  it("marks provider before kakao sign-in and keeps marker on success", async () => {
    const events: string[] = [];
    const markProvider = vi.fn((provider: "google" | "kakao") => {
      events.push(`mark:${provider}`);
      return "attempt-kakao-1";
    });
    const signInWithKakao = vi.fn(async () => {
      events.push("kakao:signin");
    });
    const clearProviderMarker = vi.fn(() => {
      events.push("clear");
    });

    await startOAuthSignInWithMarker("kakao", {
      clearProviderMarker,
      markProvider,
      launchTimeoutMs: 500,
      signInWithGoogle: vi.fn(),
      signInWithKakao,
    });

    expect(events).toEqual(["mark:kakao", "kakao:signin"]);
    expect(clearProviderMarker).not.toHaveBeenCalled();
  });

  it("marks provider before google sign-in and clears marker on failure", async () => {
    const events: string[] = [];
    const markProvider = vi.fn((provider: "google" | "kakao") => {
      events.push(`mark:${provider}`);
      return "attempt-google-1";
    });
    const clearProviderMarker = vi.fn(() => {
      events.push("clear");
    });
    const signInError = new Error("oauth disabled");

    await expect(
      startOAuthSignInWithMarker("google", {
        clearProviderMarker,
        markProvider,
        launchTimeoutMs: 500,
        signInWithGoogle: vi.fn(async () => {
          events.push("google:signin");
          throw signInError;
        }),
        signInWithKakao: vi.fn(),
      }),
    ).rejects.toMatchObject({
      message: "oauth disabled",
      oauthAttemptId: "attempt-google-1",
    });

    expect(events).toEqual(["mark:google", "google:signin", "clear"]);
    expect(clearProviderMarker).toHaveBeenCalledTimes(1);
  });

  it("fails fast when oauth launch call hangs", async () => {
    const events: string[] = [];
    const markProvider = vi.fn((provider: "google" | "kakao") => {
      events.push(`mark:${provider}`);
      return "attempt-timeout-1";
    });
    const clearProviderMarker = vi.fn(() => {
      events.push("clear");
    });

    await expect(
      startOAuthSignInWithMarker("kakao", {
        clearProviderMarker,
        markProvider,
        launchTimeoutMs: 5,
        signInWithGoogle: vi.fn(),
        signInWithKakao: () =>
          new Promise(() => {
            // Intentionally unresolved to simulate launch hang.
          }),
      }),
    ).rejects.toMatchObject({
      message: "kakao OAuth launch timeout (5ms)",
      oauthAttemptId: "attempt-timeout-1",
    });

    expect(events).toEqual(["mark:kakao", "clear"]);
    expect(clearProviderMarker).toHaveBeenCalledTimes(1);
  });
});
