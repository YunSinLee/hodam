// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NavBar from "@/app/components/NavBar";
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

describe("NavBar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState({}, "", "/service?draft=1");
    useUserInfo.setState({
      userInfo: defaultState,
      isAuthReady: false,
      hasHydrated: false,
    });
    useBead.setState({ bead: defaultBead });
    mocks.initializeBead.mockResolvedValue({ ...defaultBead, count: 12 });
  });

  afterEach(cleanup);

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
