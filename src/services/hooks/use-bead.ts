import { create } from "zustand";

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

const useBead = create<BeadState & BeadActions>(set => ({
  bead: defaultState,
  setBead: (bead: Bead) => {
    set({ bead });
  },
  deleteBead: () => {
    set({ bead: defaultState });
  },
}));

export default useBead;
