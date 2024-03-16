import { create } from "zustand";

interface userInfoType {
  profileUrl: string;
  id: string | undefined;
  email: string | undefined;
}

interface UserInfoState {
  userInfo: userInfoType;
}

interface UserInfoActions {
  setUserInfo: (userinfo: userInfoType) => void;
  deleteUserInfo: () => void;
}

export const defaultState = { profileUrl: "", id: undefined, email: undefined };

const useUserInfo = create<UserInfoState & UserInfoActions>(set => ({
  userInfo: defaultState,
  setUserInfo: (userInfo: userInfoType) => {
    set({ userInfo });
  },
  deleteUserInfo: () => {
    set({ userInfo: defaultState });
  },
}));

export default useUserInfo;
