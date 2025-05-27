import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Bead {
  id: string | undefined;
  count: number | undefined;
  created: string | undefined;
  user_id: string | undefined;
}

interface BeadState {
  bead: Bead;
}

interface BeadActions {
  setBead: (bead: Bead) => void;
  deleteBead: () => void;
}

export const defaultState = {
  id: undefined,
  count: undefined,
  created: undefined,
  user_id: undefined,
};

const useBead = create<BeadState & BeadActions>()(
  persist(
    set => ({
      bead: defaultState,
      setBead: (bead: Bead) => {
        set({ bead });
      },
      deleteBead: () => {
        set({ bead: defaultState });
      },
    }),
    {
      name: "hodam-bead-info", // localStorage 키 이름
      partialize: state => ({ bead: state.bead }), // 저장할 상태만 선택
    },
  ),
);

export default useBead;
