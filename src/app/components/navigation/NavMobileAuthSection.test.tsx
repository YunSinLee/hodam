import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NavMobileAuthSection from "@/app/components/navigation/NavMobileAuthSection";

describe("NavMobileAuthSection", () => {
  it("renders loading skeleton before hydration", () => {
    const html = renderToStaticMarkup(
      createElement(NavMobileAuthSection, {
        hasHydrated: false,
        userId: undefined,
        userEmail: undefined,
        onCloseMenu: () => {},
        onSignOut: () => {},
      }),
    );

    expect(html).toContain("animate-pulse");
    expect(html).not.toContain("로그인");
  });

  it("renders profile and sign-out for authenticated user", () => {
    const html = renderToStaticMarkup(
      createElement(NavMobileAuthSection, {
        hasHydrated: true,
        userId: "user-1",
        userEmail: "test@example.com",
        onCloseMenu: () => {},
        onSignOut: () => {},
      }),
    );

    expect(html).toContain("내 프로필");
    expect(html).toContain("로그아웃");
    expect(html).toContain("test@example.com");
  });

  it("renders sign-in CTA for guest user", () => {
    const html = renderToStaticMarkup(
      createElement(NavMobileAuthSection, {
        hasHydrated: true,
        userId: undefined,
        userEmail: undefined,
        onCloseMenu: () => {},
        onSignOut: () => {},
      }),
    );

    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("로그인");
  });
});
