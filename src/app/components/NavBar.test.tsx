import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import NavBar from "@/app/components/NavBar";
import useNavBarController from "@/app/components/navigation/useNavBarController";

vi.mock("@/app/components/navigation/useNavBarController", () => ({
  default: vi.fn(),
}));

const mockUseNavBarController = useNavBarController as unknown as Mock;

describe("NavBar", () => {
  beforeEach(() => {
    mockUseNavBarController.mockReset();
    mockUseNavBarController.mockReturnValue({
      state: {
        pathname: "/",
        hasHydrated: true,
        userId: undefined,
        userEmail: undefined,
        beadCount: 0,
        isShowMenu: false,
        isScrolled: false,
      },
      handlers: {
        onSignOut: () => {},
        onToggleMenu: () => {},
        onCloseMenu: () => {},
      },
    });
  });

  it("renders login CTA when unauthenticated", () => {
    mockUseNavBarController.mockReturnValue({
      state: {
        pathname: "/",
        hasHydrated: true,
        userId: undefined,
        userEmail: undefined,
        beadCount: 0,
        isShowMenu: false,
        isScrolled: false,
      },
      handlers: {
        onSignOut: () => {},
        onToggleMenu: () => {},
        onCloseMenu: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(NavBar));

    expect(html).toContain("HODAM");
    expect(html).toContain("홈");
    expect(html).toContain("시작하기");
    expect(html).toContain("내 동화");
    expect(html).toContain("로그인");
    expect(html).toContain('aria-controls="mobile-nav-menu"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("renders profile and sign-out actions when authenticated", () => {
    mockUseNavBarController.mockReturnValue({
      state: {
        pathname: "/my-story/7",
        hasHydrated: true,
        userId: "user-1",
        userEmail: "test@example.com",
        beadCount: 12,
        isShowMenu: false,
        isScrolled: false,
      },
      handlers: {
        onSignOut: () => {},
        onToggleMenu: () => {},
        onCloseMenu: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(NavBar));

    expect(html).toContain("test@example.com");
    expect(html).toContain("로그아웃");
    expect(html).toContain("12");
    expect(html).toContain("내 프로필");
  });
});
