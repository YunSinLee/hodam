import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createSafePersistStorage } from "@/lib/client/zustand-storage";

interface UserInfoType {
  profileUrl: string;
  id: string | undefined;
  email: string | undefined;
}

interface UserInfoState {
  userInfo: UserInfoType;
  hasHydrated: boolean;
}

interface UserInfoActions {
  setUserInfo: (userinfo: UserInfoType) => void;
  deleteUserInfo: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const defaultState = { profileUrl: "", id: undefined, email: undefined };

const useUserInfo = create<UserInfoState & UserInfoActions>()(
  persist(
    set => ({
      userInfo: defaultState,
      hasHydrated: false,
      setUserInfo: (userInfo: UserInfoType) => {
        set({ userInfo, hasHydrated: true });
      },
      deleteUserInfo: () => {
        set({ userInfo: defaultState, hasHydrated: true });
      },
      setHasHydrated: (value: boolean) => {
        set({ hasHydrated: value });
      },
    }),
    {
      name: "hodam-user-info", // localStorage 키 이름
      partialize: state => ({ userInfo: state.userInfo }), // 저장할 상태만 선택
      storage: createSafePersistStorage(),
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export default useUserInfo;
