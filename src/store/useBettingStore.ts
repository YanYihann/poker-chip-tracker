import { create } from "zustand";

import type { BettingSlice } from "@/types/domain";

const INITIAL_BETTING: BettingSlice = {
  pot: 0,
  currentBet: 0,
  minBet: 200,
  minRaiseDelta: 200,
  lastAggressiveAmount: 200
};

type BettingStore = BettingSlice & {
  setPot: (pot: number) => void;
  setCurrentBet: (currentBet: number) => void;
  setLastAggressiveAmount: (amount: number) => void;
  resetForNewHand: () => void;
  applySnapshot: (slice: BettingSlice) => void;
};

export const useBettingStore = create<BettingStore>((set) => ({
  ...INITIAL_BETTING,
  setPot: (pot) => set({ pot }),
  setCurrentBet: (currentBet) => set({ currentBet }),
  setLastAggressiveAmount: (amount) => set({ lastAggressiveAmount: amount }),
  resetForNewHand: () => {
    set({
      pot: 0,
      currentBet: 0,
      lastAggressiveAmount: INITIAL_BETTING.lastAggressiveAmount
    });
  },
  applySnapshot: (slice) => {
    set({
      pot: slice.pot,
      currentBet: slice.currentBet,
      minBet: slice.minBet,
      minRaiseDelta: slice.minRaiseDelta,
      lastAggressiveAmount: slice.lastAggressiveAmount
    });
  }
}));
