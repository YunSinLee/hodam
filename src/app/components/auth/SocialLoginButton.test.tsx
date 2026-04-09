import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SocialLoginButton from "@/app/components/auth/SocialLoginButton";

describe("SocialLoginButton", () => {
  it("renders disabled reason when provider is unavailable", () => {
    const html = renderToStaticMarkup(
      createElement(SocialLoginButton, {
        provider: "kakao",
        loading: false,
        disabled: true,
        disabledReason: "Supabase Auth 설정에서 비활성화되어 있습니다.",
        onClick: vi.fn(),
      }),
    );

    expect(html).toContain("카카오로 시작하기");
    expect(html).toContain("사용 불가 사유");
    expect(html).toContain("Supabase Auth 설정에서 비활성화되어 있습니다.");
  });

  it("does not render disabled reason for enabled provider", () => {
    const html = renderToStaticMarkup(
      createElement(SocialLoginButton, {
        provider: "google",
        loading: false,
        disabled: false,
        disabledReason: "should-not-be-shown",
        onClick: vi.fn(),
      }),
    );

    expect(html).toContain("Google로 시작하기");
    expect(html).not.toContain("사용 불가 사유");
  });
});
