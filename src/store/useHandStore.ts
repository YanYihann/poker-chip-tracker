import { create } from "zustand";

import { buildActionOrder } from "@/features/table/rules";
import { useSessionStore } from "@/store/useSessionStore";
import type { HandAuditEntry, HandSlice, TableActionType, TableSnapshot } from "@/types/domain";

function createInitialHandSlice(): HandSlice {
  const session = useSessionStore.getState();
  const actionOrder = buildActionOrder(session.players, session.dealerSeatIndex, "preflop");

  return {
    street: "preflop",
    status: "in-progress",
    actingPlayerId: actionOrder[0] ?? null,
    actionOrder,
    actionIndex: 0,
    actionCount: 0
  };
}

type HandStore = HandSlice & {
  historyStack: TableSnapshot[];
  auditTrail: HandAuditEntry[];
  setActionOrder: (actionOrder: string[]) => void;
  setActingPlayerId: (playerId: string | null) => void;
  setStreet: (street: HandSlice["street"]) => void;
  setStatus: (status: HandSlice["status"]) => void;
  markAction: (actionType: TableActionType) => void;
  pushSnapshot: (snapshot: TableSnapshot) => void;
  popSnapshot: () => TableSnapshot | undefined;
  appendAudit: (entry: HandAuditEntry) => void;
  resetForNewHand: (actionOrder: string[]) => void;
  applySnapshot: (slice: HandSlice) => void;
};

const INITIAL_HAND = createInitialHandSlice();

export const useHandStore = create<HandStore>((set, get) => ({
  ...INITIAL_HAND,
  historyStack: [],
  auditTrail: [],
  setActionOrder: (actionOrder) => {
    set({ actionOrder, actionIndex: 0, actingPlayerId: actionOrder[0] ?? null });
  },
  setActingPlayerId: (playerId) => {
    set({ actingPlayerId: playerId });
  },
  setStreet: (street) => {
    set({ street });
  },
  setStatus: (status) => {
    set({ status });
  },
  markAction: (actionType) => {
    const { actionCount } = get();

    set({
      lastActionType: actionType,
      actionCount: actionCount + 1
    });
  },
  pushSnapshot: (snapshot) => {
    const { historyStack } = get();
    set({ historyStack: [...historyStack, snapshot] });
  },
  popSnapshot: () => {
    const { historyStack } = get();

    if (historyStack.length === 0) {
      return undefined;
    }

    const snapshot = historyStack[historyStack.length - 1];
    set({ historyStack: historyStack.slice(0, -1) });
    return snapshot;
  },
  appendAudit: (entry) => {
    const { auditTrail } = get();
    set({ auditTrail: [...auditTrail, entry] });
  },
  resetForNewHand: (actionOrder) => {
    set({
      street: "preflop",
      status: "in-progress",
      actionOrder,
      actingPlayerId: actionOrder[0] ?? null,
      actionIndex: 0,
      lastActionType: undefined,
      actionCount: 0
    });
  },
  applySnapshot: (slice) => {
    set({
      street: slice.street,
      status: slice.status,
      actingPlayerId: slice.actingPlayerId,
      actionOrder: slice.actionOrder,
      actionIndex: slice.actionIndex,
      lastActionType: slice.lastActionType,
      actionCount: slice.actionCount
    });
  }
}));
