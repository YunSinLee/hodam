import { create } from "zustand";

interface UserInfoType {
  profileUrl: string;
  id: string | undefined;
  email: string | undefined;
}
export const defaultState: UserInfoType = {
  profileUrl: "",
  id: undefined,
  email: undefined,
};
const useUserInfo = create<{
  userInfo: UserInfoType;
  isAuthReady: boolean;
  setAuthReady: (ready: boolean) => void;
  setUserInfo: (userInfo: UserInfoType) => void;
  deleteUserInfo: () => void;
}>(set => ({
  userInfo: defaultState,
  isAuthReady: false,
  setAuthReady: isAuthReady => set({ isAuthReady }),
  setUserInfo: userInfo => set({ userInfo }),
  deleteUserInfo: () => set({ userInfo: defaultState }),
}));
export default useUserInfo;
