import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useUserInfo, { defaultState } from "@/services/hooks/use-user-info";

describe("useUserInfo store", () => {
  beforeEach(() => {
    useUserInfo.setState({
      userInfo: defaultState,
      isAuthReady: false,
      hasHydrated: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with non-hydrated default state", () => {
    const state = useUserInfo.getState();
    expect(state.userInfo).toEqual(defaultState);
    expect(state.hasHydrated).toBe(false);
    expect(state.isAuthReady).toBe(false);
  });

  it("marks store hydrated when user info is set", () => {
    const { setUserInfo } = useUserInfo.getState();
    setUserInfo({
      id: "user-1",
      email: "user@example.com",
      profileUrl: "https://example.com/avatar.png",
    });

    const state = useUserInfo.getState();
    expect(state.userInfo).toEqual({
      id: "user-1",
      email: "user@example.com",
      profileUrl: "https://example.com/avatar.png",
    });
    expect(state.hasHydrated).toBe(true);
    expect(state.isAuthReady).toBe(true);
  });

  it("keeps hydrated=true when user info is deleted", () => {
    const { setUserInfo, deleteUserInfo } = useUserInfo.getState();
    setUserInfo({
      id: "user-1",
      email: "user@example.com",
      profileUrl: "https://example.com/avatar.png",
    });

    deleteUserInfo();

    const state = useUserInfo.getState();
    expect(state.userInfo).toEqual(defaultState);
    expect(state.hasHydrated).toBe(true);
    expect(state.isAuthReady).toBe(true);
  });

  it("supports explicit hydration flag updates", () => {
    const { setHasHydrated } = useUserInfo.getState();
    setHasHydrated(true);
    expect(useUserInfo.getState().hasHydrated).toBe(true);
    expect(useUserInfo.getState().isAuthReady).toBe(false);

    setHasHydrated(false);
    expect(useUserInfo.getState().hasHydrated).toBe(false);
  });

  it("makes a resolved signed-out session ready for both page generations", () => {
    useUserInfo.getState().setUserInfo(defaultState);

    expect(useUserInfo.getState()).toMatchObject({
      userInfo: defaultState,
      hasHydrated: true,
      isAuthReady: true,
    });
  });

  it("supports the QA navigation readiness setter", () => {
    useUserInfo.getState().setAuthReady(true);
    expect(useUserInfo.getState()).toMatchObject({
      hasHydrated: true,
      isAuthReady: true,
    });

    useUserInfo.getState().setAuthReady(false);
    expect(useUserInfo.getState()).toMatchObject({
      hasHydrated: false,
      isAuthReady: false,
    });
  });

  it("does not restore stale persisted identities or persist new identities", async () => {
    const getItem = vi
      .fn()
      .mockReturnValue(
        JSON.stringify({ state: { userInfo: { id: "expired-user" } } }),
      );
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { getItem, setItem } });
    vi.resetModules();

    const { default: freshStore } = await import("./use-user-info");
    expect(freshStore.getState()).toMatchObject({
      userInfo: defaultState,
      hasHydrated: false,
      isAuthReady: false,
    });
    freshStore.getState().setUserInfo({
      id: "current-user",
      email: "current@example.com",
      profileUrl: "",
    });

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
