import { useMemo } from "react";

import { useBettingStore } from "@/store/useBettingStore";
import { useHandStore } from "@/store/useHandStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useSettlementStore } from "@/store/useSettlementStore";
import type { PersistedLiveSession, TableSnapshot } from "@/types/domain";

function clonePlayers(snapshotPlayers: TableSnapshot["session"]["players"]) {
  return snapshotPlayers.map((player) => ({ ...player }));
}

export function createTableSnapshotFromStores(): TableSnapshot {
  const session = useSessionStore.getState();
  const hand = useHandStore.getState();
  const betting = useBettingStore.getState();
  const settlement = useSettlementStore.getState();

  return {
    session: {
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      startedAtIso: session.startedAtIso,
      dealerSeatIndex: session.dealerSeatIndex,
      players: clonePlayers(session.players)
    },
    hand: {
      street: hand.street,
      status: hand.status,
      actingPlayerId: hand.actingPlayerId,
      actionOrder: [...hand.actionOrder],
      actionIndex: hand.actionIndex,
      lastActionType: hand.lastActionType,
      actionCount: hand.actionCount
    },
    betting: {
      pot: betting.pot,
      currentBet: betting.currentBet,
      minBet: betting.minBet,
      minRaiseDelta: betting.minRaiseDelta,
      lastAggressiveAmount: betting.lastAggressiveAmount
    },
    settlement: {
      isDialogOpen: settlement.isDialogOpen,
      revision: settlement.revision,
      notes: settlement.notes
    }
  };
}

export function applyTableSnapshot(snapshot: TableSnapshot): void {
  useSessionStore.getState().applySnapshot({
    ...snapshot.session,
    players: clonePlayers(snapshot.session.players)
  });

  useHandStore.getState().applySnapshot({
    ...snapshot.hand,
    actionOrder: [...snapshot.hand.actionOrder]
  });

  useBettingStore.getState().applySnapshot({ ...snapshot.betting });
  useSettlementStore.getState().applySnapshot({ ...snapshot.settlement });
}

export function createPersistedLiveSession(): PersistedLiveSession {
  return {
    version: 1,
    savedAtIso: new Date().toISOString(),
    snapshot: createTableSnapshotFromStores()
  };
}

export function usePotFormatter(amount: number): string {
  return useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(amount),
    [amount]
  );
}
