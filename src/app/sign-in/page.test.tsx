import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import SignInPage from "@/app/sign-in/page";
import useSignInPageController from "@/app/sign-in/useSignInPageController";

vi.mock("@/app/sign-in/useSignInPageController", () => ({
  default: vi.fn(),
}));

const mockUseSignInPageController = useSignInPageController as unknown as Mock;

describe("SignIn page", () => {
  beforeEach(() => {
    mockUseSignInPageController.mockReset();
  });

  it("renders OAuth warnings and disables provider button when unavailable", () => {
    mockUseSignInPageController.mockReturnValue({
      state: {
        providerAvailability: {
          kakao: false,
          google: true,
        },
        providerWarnings: {
          kakao: "Supabase Auth 설정에서 비활성화되어 있습니다.",
          google: null,
        },
        isKakaoLoading: false,
        isGoogleLoading: false,
        isAnyLoading: false,
        errorMessage: "카카오 로그인 중 오류가 발생했습니다.",
        authConfigWarning: "NEXT_PUBLIC_SITE_URL 설정을 확인하세요.",
        authProviderWarning:
          "카카오 로그인: Supabase Auth 설정에서 비활성화되어 있습니다.",
        resolvedRedirectUrl: "http://localhost:3000/auth/callback",
        recoveryHint: "인증 코드가 만료되었을 수 있습니다.",
      },
      handlers: {
        signInWithProvider: async () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(SignInPage));

    expect(html).toContain("카카오 로그인 중 오류가 발생했습니다.");
    expect(html).toContain("로그인 설정 점검 필요");
    expect(html).toContain("OAuth provider 점검");
    expect(html).toContain("이전 로그인 시도 안내");
    expect(html).toContain("카카오로 시작하기");
    expect(html).toContain("Google로 시작하기");
    expect(html).toContain("사용 불가 사유");
    expect(html).toContain("disabled");
  });

  it("renders callback url notice when config warning is absent", () => {
    mockUseSignInPageController.mockReturnValue({
      state: {
        providerAvailability: {
          kakao: true,
          google: true,
        },
        providerWarnings: {
          kakao: null,
          google: null,
        },
        isKakaoLoading: false,
        isGoogleLoading: false,
        isAnyLoading: false,
        errorMessage: null,
        authConfigWarning: null,
        authProviderWarning: null,
        resolvedRedirectUrl: "http://localhost:3000/auth/callback",
        recoveryHint: null,
      },
      handlers: {
        signInWithProvider: async () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(SignInPage));

    expect(html).toContain("OAuth callback URL:");
    expect(html).toContain("http://localhost:3000/auth/callback");
  });
});
