import { beforeEach, describe, expect, it } from "vitest";

import useUserInfo, { defaultState } from "@/services/hooks/use-user-info";

describe("useUserInfo store", () => {
  beforeEach(() => {
    useUserInfo.setState({
      userInfo: defaultState,
      hasHydrated: false,
    });
  });

  it("starts with non-hydrated default state", () => {
    const state = useUserInfo.getState();
    expect(state.userInfo).toEqual(defaultState);
    expect(state.hasHydrated).toBe(false);
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
  });

  it("supports explicit hydration flag updates", () => {
    const { setHasHydrated } = useUserInfo.getState();
    setHasHydrated(true);
    expect(useUserInfo.getState().hasHydrated).toBe(true);

    setHasHydrated(false);
    expect(useUserInfo.getState().hasHydrated).toBe(false);
  });
});
