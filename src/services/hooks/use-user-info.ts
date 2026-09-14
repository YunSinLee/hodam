import { create } from "zustand";

interface UserInfoType {
  profileUrl: string;
  id: string | undefined;
  email: string | undefined;
}

interface UserInfoStore {
  userInfo: UserInfoType;
  isAuthReady: boolean;
  hasHydrated: boolean;
  setUserInfo: (userInfo: UserInfoType) => void;
  deleteUserInfo: () => void;
  setAuthReady: (ready: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
}

export const defaultState: UserInfoType = {
  profileUrl: "",
  id: undefined,
  email: undefined,
};

// Authentication is resolved from the live Supabase session. Persisted user
// identities must never make protected pages treat an expired session as valid.
const useUserInfo = create<UserInfoStore>(set => ({
  userInfo: defaultState,
  isAuthReady: false,
  hasHydrated: false,
  setUserInfo: userInfo =>
    set({ userInfo, isAuthReady: true, hasHydrated: true }),
  deleteUserInfo: () =>
    set({ userInfo: defaultState, isAuthReady: true, hasHydrated: true }),
  setAuthReady: ready => set({ isAuthReady: ready, hasHydrated: ready }),
  // Keep the legacy hydration interface without treating hydration alone as
  // evidence that the authentication session has been checked.
  setHasHydrated: hasHydrated => set({ hasHydrated }),
}));

export default useUserInfo;
