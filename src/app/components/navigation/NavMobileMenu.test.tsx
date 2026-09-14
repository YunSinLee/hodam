import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NavMobileMenu from "@/app/components/navigation/NavMobileMenu";

describe("NavMobileMenu", () => {
  it("renders collapsed state class when closed", () => {
    const html = renderToStaticMarkup(
      createElement(NavMobileMenu, {
        isOpen: false,
        pathname: "/",
        hasHydrated: true,
        userId: undefined,
        userEmail: undefined,
        onCloseMenu: () => {},
        onSignOut: () => {},
      }),
    );

    expect(html).toContain("max-h-0");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("로그인");
  });

  it("renders authenticated profile and sign-out in open state", () => {
    const html = renderToStaticMarkup(
      createElement(NavMobileMenu, {
        isOpen: true,
        pathname: "/my-story/1",
        hasHydrated: true,
        userId: "user-1",
        userEmail: "test@example.com",
        onCloseMenu: () => {},
        onSignOut: () => {},
      }),
    );

    expect(html).toContain("max-h-[calc(100vh-4rem)]");
    expect(html).toContain('id="mobile-nav-menu"');
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain("내 프로필");
    expect(html).toContain("로그아웃");
    expect(html).toContain("내 동화");
  });
});
