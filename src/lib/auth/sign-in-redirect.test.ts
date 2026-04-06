import { describe, expect, it } from "vitest";

import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";

describe("buildSignInRedirectPath", () => {
  it("builds sign-in redirect query with encoded next path", () => {
    expect(buildSignInRedirectPath("/my-story/123?tab=detail")).toBe(
      "/sign-in?auth_error=callback_failed&next=%2Fmy-story%2F123%3Ftab%3Ddetail",
    );
  });

  it("falls back to root when next path is unsafe", () => {
    expect(buildSignInRedirectPath("https://evil.com")).toBe(
      "/sign-in?auth_error=callback_failed&next=%2F",
    );
  });

  it("uses provided auth error code", () => {
    expect(buildSignInRedirectPath("/profile", "session_expired")).toBe(
      "/sign-in?auth_error=session_expired&next=%2Fprofile",
    );
  });
});
