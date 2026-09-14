// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NavBar from "@/app/components/NavBar";
import {
  associateSearchGeneration,
  beginSearchGeneration,
  completeSearchGeneration,
} from "@/lib/client/search-analytics";
import useBead, {
  defaultState as defaultBead,
} from "@/services/hooks/use-bead";
import useUserInfo, { defaultState } from "@/services/hooks/use-user-info";

const mocks = vi.hoisted(() => ({
  authListener: vi.fn(),
  unsubscribe: vi.fn(),
  initializeBead: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/app/api/bead", () => ({
  default: { initializeBead: mocks.initializeBead },
}));
vi.mock("@/app/api/user", () => ({ default: { signOut: mocks.signOut } }));
vi.mock("@/app/utils/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: () => void) => {
        mocks.authListener.mockImplementation(listener);
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
  },
}));

function controlClickWithoutBrowserNavigation(link: HTMLElement) {
  let preventedByApp: boolean | undefined;
  window.addEventListener(
    "click",
    event => {
      preventedByApp = event.defaultPrevented;
      // JSDOM cannot open tabs. Cancel only after React's handlers have run,
      // so the assertion still checks that the app preserved native behavior.
      event.preventDefault();
    },
    { once: true },
  );
  fireEvent.click(link, { ctrlKey: true });
  expect(preventedByApp).toBe(false);
}

describe("NavBar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/service?draft=1");
    useUserInfo.setState({
      userInfo: defaultState,
      isAuthReady: false,
      hasHydrated: false,
    });
    useBead.setState({ bead: defaultBead });
    mocks.initializeBead.mockResolvedValue({ ...defaultBead, count: 12 });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "gtag");
  });

  it.each([
    ["desktop", "/bedtime-stories", "bedtime"],
    ["mobile", "/bedtime-stories/moonlit-rabbit", "moonlit-rabbit"],
  ])(
    "tracks the %s creation menu and its completed book from %s",
    (menuType, pathname, source) => {
      window.history.replaceState({}, "", pathname);
      const gtag = vi.fn();
      Object.defineProperty(window, "gtag", {
        configurable: true,
        value: gtag,
      });
      render(<NavBar />);
      if (menuType === "mobile")
        fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
      const menu = screen.getByRole("navigation", {
        name: menuType === "mobile" ? "모바일 메뉴" : "주 메뉴",
      });
      const link = within(menu).getByRole("link", { name: "그림책 만들기" });
      expect(link.getAttribute("href")).toBe("/service");
      // Ctrl-click keeps the browser's native new-tab navigation available.
      controlClickWithoutBrowserNavigation(link);
      expect(window.sessionStorage.getItem("hodam:search-source")).toBe(source);
      const attempt = beginSearchGeneration();
      associateSearchGeneration(attempt, 851);
      completeSearchGeneration(851, {
        status: "complete",
        pageCount: 8,
        hasAllImages: true,
      });
      expect(gtag.mock.calls.map(call => call[1])).toEqual([
        "hodam_cta_click",
        "hodam_generation_started",
        "hodam_generation_completed",
      ]);
      expect(gtag.mock.calls.map(call => call[2].search_source)).toEqual([
        source,
        source,
        source,
      ]);
    },
  );

  it("leaves unrelated menus and creation links outside public pages untracked", () => {
    const gtag = vi.fn();
    Object.defineProperty(window, "gtag", {
      configurable: true,
      value: gtag,
    });
    const { unmount } = render(<NavBar />);
    const serviceLink = screen.getByRole("link", { name: "그림책 만들기" });
    expect(serviceLink.getAttribute("aria-current")).toBe("page");
    controlClickWithoutBrowserNavigation(serviceLink);
    unmount();
    window.history.replaceState({}, "", "/ai-storybook");
    render(<NavBar />);
    controlClickWithoutBrowserNavigation(
      screen.getByRole("link", { name: "내 책장" }),
    );
    expect(gtag).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("hodam:search-source")).toBeNull();
  });

  it("preserves the creation query in the login link after session readiness", () => {
    render(<NavBar />);
    act(() => {
      mocks.authListener("INITIAL_SESSION", null);
    });

    expect(
      screen.getByRole("link", { name: "로그인" }).getAttribute("href"),
    ).toBe("/sign-in?next=%2Fservice%3Fdraft%3D1");
    expect(screen.getByRole("link", { name: "그림책 만들기" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "내 책장" })).toBeTruthy();
    expect(useUserInfo.getState().isAuthReady).toBe(true);
    expect(useUserInfo.getState().hasHydrated).toBe(true);
    expect(mocks.authListener.mock.results[0].value).toBeUndefined();
  });

  it("shows the resolved account balance and signs out through the mobile menu", async () => {
    render(<NavBar />);
    act(() => {
      mocks.authListener("SIGNED_IN", {
        user: { id: "user-1", email: "test@example.com", user_metadata: {} },
      });
    });

    expect(screen.getByRole("link", { name: "내 프로필" })).toBeTruthy();
    await screen.findByRole("link", { name: "보유 곶감 12" });
    const menu = screen.getByRole("button", { name: "메뉴 열기" });
    fireEvent.click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(menu.getAttribute("aria-expanded")).toBe("false");
  });

  it("clears user and balance on sign-out without leaving the auth listener pending", async () => {
    const { unmount } = render(<NavBar />);
    act(() => {
      mocks.authListener("SIGNED_IN", {
        user: { id: "user-1", email: "test@example.com", user_metadata: {} },
      });
    });
    await screen.findByRole("link", { name: "보유 곶감 12" });
    act(() => {
      mocks.authListener("SIGNED_OUT", null);
    });

    expect(useUserInfo.getState().userInfo).toEqual(defaultState);
    expect(useBead.getState().bead).toEqual(defaultBead);
    expect(mocks.authListener.mock.results[1].value).toBeUndefined();
    expect(screen.queryByRole("link", { name: "내 프로필" })).toBeNull();
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
