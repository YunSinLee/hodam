import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserInfoType {
  profileUrl: string;
  id: string | undefined;
  email: string | undefined;
}

interface UserInfoState {
  userInfo: UserInfoType;
}

interface UserInfoActions {
  setUserInfo: (userinfo: UserInfoType) => void;
  deleteUserInfo: () => void;
}

export const defaultState = { profileUrl: "", id: undefined, email: undefined };

const useUserInfo = create<UserInfoState & UserInfoActions>()(
  persist(
    set => ({
      userInfo: defaultState,
      setUserInfo: (userInfo: UserInfoType) => {
        set({ userInfo });
      },
      deleteUserInfo: () => {
        set({ userInfo: defaultState });
      },
    }),
    {
      name: "hodam-user-info", // localStorage 키 이름
      partialize: state => ({ userInfo: state.userInfo }), // 저장할 상태만 선택
    },
  ),
);

export default useUserInfo;
