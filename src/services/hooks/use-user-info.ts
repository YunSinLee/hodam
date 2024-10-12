import { create } from "zustand";

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

const useUserInfo = create<UserInfoState & UserInfoActions>(set => ({
  userInfo: defaultState,
  setUserInfo: (userInfo: UserInfoType) => {
    set({ userInfo });
  },
  deleteUserInfo: () => {
    set({ userInfo: defaultState });
  },
}));

export default useUserInfo;
