import { describe, expect, it } from "vitest";

import { normalizeOAuthProviderAvailability } from "@/lib/auth/oauth-provider-health";

describe("oauth-provider-health", () => {
  it("keeps providers enabled when payload is invalid", () => {
    expect(normalizeOAuthProviderAvailability(null)).toEqual({
      availability: {
        kakao: true,
        google: true,
      },
      providerWarnings: {
        kakao: null,
        google: null,
      },
      warnings: [],
    });
  });

  it("disables provider when auth settings marks it disabled", () => {
    const parsed = normalizeOAuthProviderAvailability({
      providers: {
        kakao: {
          enabled: false,
          reason: "disabled_in_supabase_auth_settings",
        },
        google: {
          enabled: true,
        },
      },
    });

    expect(parsed.availability).toEqual({
      kakao: false,
      google: true,
    });
    expect(parsed.providerWarnings).toEqual({
      kakao: "Supabase Auth 설정에서 비활성화되어 있습니다.",
      google: null,
    });
    expect(parsed.warnings.join(" ")).toContain(
      "카카오 로그인: Supabase Auth 설정에서 비활성화되어 있습니다.",
    );
  });

  it("includes global warnings and provider health fetch warnings", () => {
    const parsed = normalizeOAuthProviderAvailability({
      warnings: ["NEXT_PUBLIC_SITE_URL(origin) mismatch"],
      providers: {
        kakao: {
          enabled: null,
          reason: "auth_settings_fetch_failed",
        },
        google: {
          enabled: true,
        },
      },
    });

    expect(parsed.availability).toEqual({
      kakao: true,
      google: true,
    });
    expect(parsed.providerWarnings).toEqual({
      kakao: null,
      google: null,
    });
    expect(parsed.warnings).toContain("NEXT_PUBLIC_SITE_URL(origin) mismatch");
    expect(parsed.warnings.join(" ")).toContain("카카오 로그인 상태 확인 실패");
  });
});
