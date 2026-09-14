import { describe, expect, it } from "vitest";

import { normalizeOAuthProviderName } from "@/lib/auth/oauth-provider";

describe("oauth-provider", () => {
  it("normalizes supported provider names", () => {
    expect(normalizeOAuthProviderName("google")).toBe("google");
    expect(normalizeOAuthProviderName("KAKAO")).toBe("kakao");
    expect(normalizeOAuthProviderName("  google  ")).toBe("google");
  });

  it("returns null for unsupported values", () => {
    expect(normalizeOAuthProviderName("github")).toBeNull();
    expect(normalizeOAuthProviderName("")).toBeNull();
    expect(normalizeOAuthProviderName(123)).toBeNull();
    expect(normalizeOAuthProviderName(null)).toBeNull();
  });
});
