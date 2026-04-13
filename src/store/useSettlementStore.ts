import { create } from "zustand";

import type { SettlementSlice } from "@/types/domain";

const INITIAL_SETTLEMENT: SettlementSlice = {
  isDialogOpen: false,
  revision: 0,
  notes: "Settlement placeholder"
};

type SettlementStore = SettlementSlice & {
  openDialog: () => void;
  closeDialog: () => void;
  markRevision: () => void;
  setNotes: (notes: string) => void;
  resetForNewHand: () => void;
  applySnapshot: (slice: SettlementSlice) => void;
};

export const useSettlementStore = create<SettlementStore>((set, get) => ({
  ...INITIAL_SETTLEMENT,
  openDialog: () => set({ isDialogOpen: true }),
  closeDialog: () => set({ isDialogOpen: false }),
  markRevision: () => {
    const { revision } = get();
    set({ revision: revision + 1 });
  },
  setNotes: (notes) => set({ notes }),
  resetForNewHand: () => {
    set({
      isDialogOpen: false,
      notes: INITIAL_SETTLEMENT.notes
    });
  },
  applySnapshot: (slice) => {
    set({
      isDialogOpen: slice.isDialogOpen,
      revision: slice.revision,
      notes: slice.notes
    });
  }
}));
