import { describe, expect, it } from "vitest";

import {
  shouldRedirectAfterSignIn,
  toSessionUserInfo,
} from "@/lib/auth/session-state";

describe("toSessionUserInfo", () => {
  it("returns null for empty session", () => {
    expect(toSessionUserInfo(null)).toBeNull();
    expect(toSessionUserInfo(undefined)).toBeNull();
  });

  it("maps session user fields", () => {
    const info = toSessionUserInfo({
      user: {
        id: "user-1",
        email: "user@example.com",
        user_metadata: {
          avatar_url: "https://example.com/avatar.png",
        },
      },
    } as never);

    expect(info).toEqual({
      profileUrl: "https://example.com/avatar.png",
      id: "user-1",
      email: "user@example.com",
    });
  });
});

describe("shouldRedirectAfterSignIn", () => {
  it("returns true on auth landing pages", () => {
    expect(shouldRedirectAfterSignIn("/sign-in")).toBe(true);
    expect(shouldRedirectAfterSignIn("/auth/callback")).toBe(true);
  });

  it("returns false on other pages", () => {
    expect(shouldRedirectAfterSignIn("/")).toBe(false);
    expect(shouldRedirectAfterSignIn("/service")).toBe(false);
    expect(shouldRedirectAfterSignIn(null)).toBe(false);
  });
});
