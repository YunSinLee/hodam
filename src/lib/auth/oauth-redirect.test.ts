import { describe, expect, it } from "vitest";

import { resolveOAuthRedirectUrl } from "@/lib/auth/oauth-redirect";

describe("resolveOAuthRedirectUrl", () => {
  it("returns explicit redirect when origin matches runtime", () => {
    const result = resolveOAuthRedirectUrl({
      runtimeOrigin: "http://localhost:3000",
      configuredAuthRedirectUrl: "http://localhost:3000",
      configuredSiteUrl: "http://localhost:3000",
    });

    expect(result.redirectTo).toBe("http://localhost:3000/auth/callback");
    expect(result.warnings).toEqual([]);
  });

  it("falls back to runtime origin when explicit redirect origin mismatches", () => {
    const result = resolveOAuthRedirectUrl({
      runtimeOrigin: "http://localhost:3000",
      configuredAuthRedirectUrl: "https://prod.example.com",
      configuredSiteUrl: "https://prod.example.com",
    });

    expect(result.redirectTo).toBe("http://localhost:3000/auth/callback");
    expect(result.warnings).toContain(
      "NEXT_PUBLIC_AUTH_REDIRECT_URL(https://prod.example.com)이 현재 접속 origin(http://localhost:3000)과 다릅니다.",
    );
    expect(result.warnings).toContain(
      "NEXT_PUBLIC_SITE_URL(https://prod.example.com)와 현재 접속 origin(http://localhost:3000)이 다릅니다.",
    );
  });

  it("uses site url when site origin matches runtime", () => {
    const result = resolveOAuthRedirectUrl({
      runtimeOrigin: "http://localhost:3000",
      configuredSiteUrl: "http://localhost:3000",
    });

    expect(result.redirectTo).toBe("http://localhost:3000/auth/callback");
    expect(result.warnings).toEqual([]);
  });

  it("returns runtime origin when no config values exist", () => {
    const result = resolveOAuthRedirectUrl({
      runtimeOrigin: "http://localhost:3000",
    });

    expect(result.redirectTo).toBe("http://localhost:3000/auth/callback");
    expect(result.warnings).toEqual([]);
  });

  it("returns warnings for invalid config urls", () => {
    const result = resolveOAuthRedirectUrl({
      runtimeOrigin: "http://localhost:3000",
      configuredAuthRedirectUrl: "invalid-url",
      configuredSiteUrl: "also-invalid",
    });

    expect(result.redirectTo).toBe("http://localhost:3000/auth/callback");
    expect(result.warnings).toContain(
      "NEXT_PUBLIC_AUTH_REDIRECT_URL 형식이 올바르지 않습니다.",
    );
    expect(result.warnings).toContain(
      "NEXT_PUBLIC_SITE_URL 형식이 올바르지 않습니다.",
    );
  });
});
