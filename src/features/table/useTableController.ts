import { useEffect, useMemo, useState } from "react";

import {
  loadLiveSession,
  clearLiveSession,
  saveLiveSession
} from "@/features/persistence/storage";
import {
  buildActionOrder,
  findPlayer,
  getActionablePlayers,
  getNextActingPlayerId,
  getPlayerToCall
} from "@/features/table/rules";
import {
  applyTableSnapshot,
  createPersistedLiveSession,
  createTableSnapshotFromStores
} from "@/features/table/snapshot";
import { useArchiveStore } from "@/store/useArchiveStore";
import { useBettingStore } from "@/store/useBettingStore";
import { useHandStore } from "@/store/useHandStore";
import { useMotionStore } from "@/store/useMotionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useSettlementStore } from "@/store/useSettlementStore";
import type {
  ArchivedSessionRecord,
  AvailablePlayerAction,
  HandStatus,
  Player,
  PlayerId,
  ReversibleTableActionType,
  Street,
  TableActionType,
  TableSnapshot
} from "@/types/domain";

const STREET_SEQUENCE: Street[] = ["preflop", "flop", "turn", "river", "showdown"];

export type MainActionModel = {
  id: AvailablePlayerAction;
  topLabel: string;
  mainLabel: string;
  onPress: () => void;
};

export type UtilityActionModel = {
  id: "undo" | "edit-hand" | "end-hand";
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export type SettlementPlayerModel = {
  id: string;
  name: string;
  stackLabel: string;
  status: Player["status"];
};

type TableStateModel = {
  sessionName: string;
  playerCount: number;
  players: Player[];
  actingPlayerId: string | null;
  pot: number;
  street: Street;
  status: HandStatus;
  toCall: number;
  mainActions: MainActionModel[];
  utilityActions: UtilityActionModel[];
  canOpenSettlement: boolean;
  settlementOpen: boolean;
  settlementPlayers: SettlementPlayerModel[];
  canSettlementUndo: boolean;
  canReopenSettlement: boolean;
  autosaveReady: boolean;
  resumeAvailable: boolean;
  resumeSavedAtIso: string | null;
  setPlayerCount: (count: number) => void;
  openSettlement: () => void;
  closeSettlement: () => void;
  undoLastAction: () => void;
  editHand: () => void;
  quickWin: (winnerId: string) => void;
  quickSplit: (winnerIds: string[]) => void;
  reopenSettlement: () => void;
  resumeSession: () => void;
  discardResumeSnapshot: () => void;
};

function formatChips(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function clonePlayers(players: Player[]): Player[] {
  return players.map((player) => ({ ...player }));
}

function cloneSnapshot(): TableSnapshot {
  return createTableSnapshotFromStores();
}

function setActingStatus(players: Player[], actingPlayerId: string | null): Player[] {
  return players.map((player) => {
    if (player.status === "folded" || player.status === "all-in" || player.status === "winner") {
      return { ...player };
    }

    if (!actingPlayerId) {
      return { ...player, status: "waiting" };
    }

    return {
      ...player,
      status: player.id === actingPlayerId ? "acting" : "waiting"
    };
  });
}

function getNextStreet(street: Street): Street | null {
  const index = STREET_SEQUENCE.indexOf(street);

  if (index < 0 || index === STREET_SEQUENCE.length - 1) {
    return null;
  }

  return STREET_SEQUENCE[index + 1];
}

function emitChipToPot(sourcePlayerId: string, amount: number): void {
  if (amount <= 0) {
    return;
  }

  useMotionStore.getState().emit({
    kind: "chip-to-pot",
    sourcePlayerId,
    amount
  });
}

function emitPotToWinner(targetPlayerId: string, amount: number, delayMs = 0): void {
  if (amount <= 0) {
    return;
  }

  useMotionStore.getState().emit({
    kind: "pot-to-winner",
    targetPlayerId,
    amount,
    delayMs
  });
}

function settleRoundIfNeeded(previousActingPlayerId: string | null): void {
  const sessionStore = useSessionStore.getState();
  const handStore = useHandStore.getState();
  const bettingStore = useBettingStore.getState();
  const settlementStore = useSettlementStore.getState();

  if (handStore.status !== "in-progress") {
    return;
  }

  const players = clonePlayers(sessionStore.players);
  const contenders = players.filter((player) => player.status !== "folded");

  if (contenders.length <= 1) {
    handStore.setStatus("pre-settlement");
    handStore.setActingPlayerId(null);
    sessionStore.setPlayers(setActingStatus(players, null));
    settlementStore.openDialog();
    return;
  }

  const actionable = getActionablePlayers(players);
  const actionableIds = new Set(actionable.map((player) => player.id));
  const currentOrder = handStore.actionOrder.filter((playerId) => actionableIds.has(playerId));
  const nextActingPlayerId = getNextActingPlayerId(currentOrder, previousActingPlayerId);

  if (nextActingPlayerId) {
    handStore.setActionOrder(currentOrder);
    handStore.setActingPlayerId(nextActingPlayerId);
    sessionStore.setPlayers(setActingStatus(players, nextActingPlayerId));
    return;
  }

  const nextStreet = getNextStreet(handStore.street);

  if (!nextStreet || nextStreet === "showdown") {
    handStore.setStreet("showdown");
    handStore.setStatus("pre-settlement");
    handStore.setActingPlayerId(null);
    sessionStore.setPlayers(setActingStatus(players, null));
    settlementStore.openDialog();
    return;
  }

  const resetPlayers = players.map((player) => ({ ...player, currentBet: 0 }));
  const nextOrder = buildActionOrder(resetPlayers, sessionStore.dealerSeatIndex, nextStreet);
  const nextStreetActing = nextOrder[0] ?? null;

  handStore.setStreet(nextStreet);
  handStore.setActionOrder(nextOrder);
  handStore.setActingPlayerId(nextStreetActing);

  bettingStore.setCurrentBet(0);
  sessionStore.setPlayers(setActingStatus(resetPlayers, nextStreetActing));
}

function pushReversibleSnapshot(actionType: ReversibleTableActionType): boolean {
  const handStore = useHandStore.getState();

  if (handStore.status === "settlement-confirmed") {
    return false;
  }

  handStore.pushSnapshot(cloneSnapshot());
  handStore.markAction(actionType);
  return true;
}

function pushActionSnapshot(actionType: TableActionType): void {
  const handStore = useHandStore.getState();
  handStore.pushSnapshot(cloneSnapshot());
  handStore.markAction(actionType);
}

function applyPlayerChipChange(playerId: string, amount: number, forceAllIn = false): Player[] {
  const sessionStore = useSessionStore.getState();

  return clonePlayers(sessionStore.players).map((player) => {
    if (player.id !== playerId || amount <= 0) {
      return player;
    }

    const applied = Math.min(amount, player.stack);
    const stackAfter = player.stack - applied;
    const status =
      forceAllIn || stackAfter === 0
        ? "all-in"
        : player.status === "acting"
          ? "waiting"
          : player.status;

    return {
      ...player,
      stack: stackAfter,
      currentBet: player.currentBet + applied,
      totalInvestedThisHand: player.totalInvestedThisHand + applied,
      status
    };
  });
}

function runAction(actionType: AvailablePlayerAction): void {
  const sessionStore = useSessionStore.getState();
  const handStore = useHandStore.getState();
  const bettingStore = useBettingStore.getState();

  if (handStore.status !== "in-progress") {
    return;
  }

  const actingPlayer = findPlayer(sessionStore.players, handStore.actingPlayerId);

  if (!actingPlayer) {
    return;
  }

  const toCall = getPlayerToCall(actingPlayer, bettingStore.currentBet);
  const previousActingPlayerId = actingPlayer.id;

  if (actionType === "fold") {
    if (!pushReversibleSnapshot(actionType)) {
      return;
    }

    const foldedPlayers: Player[] = clonePlayers(sessionStore.players).map((player) =>
      player.id === actingPlayer.id ? { ...player, status: "folded" } : player
    );

    sessionStore.setPlayers(foldedPlayers);
    settleRoundIfNeeded(previousActingPlayerId);
    return;
  }

  if (actionType === "check") {
    if (toCall > 0) {
      return;
    }

    if (!pushReversibleSnapshot(actionType)) {
      return;
    }

    sessionStore.setPlayers(clonePlayers(sessionStore.players));
    settleRoundIfNeeded(previousActingPlayerId);
    return;
  }

  if (actionType === "call") {
    if (toCall <= 0) {
      return;
    }

    if (!pushReversibleSnapshot(actionType)) {
      return;
    }

    const appliedCall = Math.min(toCall, actingPlayer.stack);
    const changedPlayers = applyPlayerChipChange(actingPlayer.id, toCall);
    const finalPlayer = findPlayer(changedPlayers, actingPlayer.id);

    sessionStore.setPlayers(changedPlayers);
    bettingStore.setPot(bettingStore.pot + appliedCall);
    emitChipToPot(actingPlayer.id, appliedCall);

    if ((finalPlayer?.currentBet ?? 0) > bettingStore.currentBet) {
      bettingStore.setCurrentBet(finalPlayer?.currentBet ?? bettingStore.currentBet);
    }

    settleRoundIfNeeded(previousActingPlayerId);
    return;
  }

  if (actionType === "bet") {
    if (toCall > 0) {
      return;
    }

    const betAmount = Math.min(actingPlayer.stack, bettingStore.minBet);

    if (betAmount <= 0) {
      return;
    }

    if (!pushReversibleSnapshot(actionType)) {
      return;
    }

    const changedPlayers = applyPlayerChipChange(actingPlayer.id, betAmount);
    const finalPlayer = findPlayer(changedPlayers, actingPlayer.id);

    sessionStore.setPlayers(changedPlayers);
    bettingStore.setPot(bettingStore.pot + betAmount);
    bettingStore.setCurrentBet(finalPlayer?.currentBet ?? bettingStore.currentBet);
    bettingStore.setLastAggressiveAmount(betAmount);
    emitChipToPot(actingPlayer.id, betAmount);

    settleRoundIfNeeded(previousActingPlayerId);
    return;
  }

  if (actionType === "raise") {
    if (toCall <= 0) {
      runAction("bet");
      return;
    }

    const raiseAmount = toCall + bettingStore.minRaiseDelta;
    const appliedAmount = Math.min(actingPlayer.stack, raiseAmount);

    if (appliedAmount <= 0) {
      return;
    }

    if (!pushReversibleSnapshot(actionType)) {
      return;
    }

    const changedPlayers = applyPlayerChipChange(actingPlayer.id, appliedAmount);
    const finalPlayer = findPlayer(changedPlayers, actingPlayer.id);
    const nextCurrentBet = Math.max(bettingStore.currentBet, finalPlayer?.currentBet ?? 0);

    sessionStore.setPlayers(changedPlayers);
    bettingStore.setPot(bettingStore.pot + appliedAmount);
    bettingStore.setCurrentBet(nextCurrentBet);
    bettingStore.setLastAggressiveAmount(
      Math.max(nextCurrentBet - bettingStore.currentBet, bettingStore.minRaiseDelta)
    );
    emitChipToPot(actingPlayer.id, appliedAmount);

    settleRoundIfNeeded(previousActingPlayerId);
    return;
  }

  if (actionType === "all-in") {
    if (actingPlayer.stack <= 0) {
      return;
    }

    if (!pushReversibleSnapshot(actionType)) {
      return;
    }

    const allInAmount = actingPlayer.stack;
    const changedPlayers = applyPlayerChipChange(actingPlayer.id, allInAmount, true);
    const finalPlayer = findPlayer(changedPlayers, actingPlayer.id);
    const nextCurrentBet = Math.max(bettingStore.currentBet, finalPlayer?.currentBet ?? 0);

    sessionStore.setPlayers(changedPlayers);
    bettingStore.setPot(bettingStore.pot + allInAmount);
    bettingStore.setCurrentBet(nextCurrentBet);
    emitChipToPot(actingPlayer.id, allInAmount);

    settleRoundIfNeeded(previousActingPlayerId);
  }
}

function runUndo(): void {
  const snapshot = useHandStore.getState().popSnapshot();

  if (!snapshot) {
    return;
  }

  applyTableSnapshot(snapshot);
}

function runEditHand(): void {
  const handStore = useHandStore.getState();
  const sessionStore = useSessionStore.getState();
  const bettingStore = useBettingStore.getState();
  const settlementStore = useSettlementStore.getState();

  if (handStore.status === "settlement-confirmed") {
    return;
  }

  const beforeStreet = handStore.street;
  const nextStreet = getNextStreet(beforeStreet) ?? "showdown";

  pushActionSnapshot("edit-hand");

  const resetPlayers = clonePlayers(sessionStore.players).map((player) => ({
    ...player,
    currentBet: 0
  }));

  const actionOrder = buildActionOrder(resetPlayers, sessionStore.dealerSeatIndex, nextStreet);
  const actingPlayerId = actionOrder[0] ?? null;

  sessionStore.setPlayers(setActingStatus(resetPlayers, actingPlayerId));
  handStore.setStreet(nextStreet);
  handStore.setStatus(nextStreet === "showdown" ? "pre-settlement" : "in-progress");
  handStore.setActionOrder(actionOrder);
  handStore.setActingPlayerId(actingPlayerId);

  if (nextStreet === "showdown") {
    settlementStore.openDialog();
  }

  bettingStore.setCurrentBet(0);
  settlementStore.markRevision();
  settlementStore.setNotes(`Edited street from ${beforeStreet} to ${nextStreet}`);

  handStore.appendAudit({
    id: `audit-${Date.now()}`,
    action: "edit-hand",
    beforeStreet,
    afterStreet: nextStreet,
    note: "Organizer adjusted current hand stage.",
    createdAtIso: new Date().toISOString()
  });
}

function createArchiveEntry(
  winners: Array<{ playerId: PlayerId; amount: number }>,
  note?: string
): ArchivedSessionRecord {
  const sessionStore = useSessionStore.getState();
  const bettingStore = useBettingStore.getState();

  return {
    id: `archive-${Date.now()}`,
    sessionName: sessionStore.sessionName,
    endedAtIso: new Date().toISOString(),
    playerCount: sessionStore.players.length,
    totalPot: bettingStore.pot,
    winners: winners.map((winner) => {
      const player = sessionStore.players.find((item) => item.id === winner.playerId);
      return {
        playerId: winner.playerId,
        name: player?.name ?? winner.playerId,
        amount: winner.amount
      };
    }),
    note
  };
}

function runEndHand(): void {
  const handStore = useHandStore.getState();
  const settlementStore = useSettlementStore.getState();

  if (handStore.status === "settlement-confirmed") {
    return;
  }

  if (!pushReversibleSnapshot("end-hand")) {
    return;
  }

  if (handStore.status === "in-progress") {
    handStore.setStatus("pre-settlement");
    handStore.setActingPlayerId(null);
    settlementStore.openDialog();
    return;
  }

  handStore.setStatus("settlement-confirmed");
  settlementStore.closeDialog();
  useArchiveStore.getState().addEntry(createArchiveEntry([], "Manual settlement confirm"));
}

function getClockwiseWinnerOrder(players: Player[], dealerSeatIndex: number, winnerIds: string[]): string[] {
  const winnerSet = new Set(winnerIds);
  const bySeat = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const dealerIndex = bySeat.findIndex((player) => player.seatIndex === dealerSeatIndex);
  const start = dealerIndex >= 0 ? dealerIndex : 0;
  const ordered: string[] = [];

  for (let step = 1; step <= bySeat.length; step += 1) {
    const cursor = (start + step) % bySeat.length;
    const id = bySeat[cursor].id;

    if (winnerSet.has(id)) {
      ordered.push(id);
    }
  }

  return ordered;
}

function runQuickWin(winnerId: string): void {
  const handStore = useHandStore.getState();
  const sessionStore = useSessionStore.getState();
  const bettingStore = useBettingStore.getState();
  const settlementStore = useSettlementStore.getState();

  if (handStore.status === "in-progress") {
    return;
  }

  const pot = bettingStore.pot;

  if (pot <= 0) {
    return;
  }

  const winner = sessionStore.players.find((player) => player.id === winnerId);

  if (!winner) {
    return;
  }

  pushActionSnapshot("quick-win");

  const updatedPlayers = clonePlayers(sessionStore.players).map((player) => {
    if (player.id === winnerId) {
      return {
        ...player,
        stack: player.stack + pot,
        status: "winner"
      } satisfies Player;
    }

    return {
      ...player,
      status: player.status === "folded" ? "folded" : "waiting"
    } satisfies Player;
  });

  sessionStore.setPlayers(updatedPlayers);
  bettingStore.setPot(0);
  bettingStore.setCurrentBet(0);

  handStore.setStatus("settlement-confirmed");
  settlementStore.closeDialog();
  settlementStore.markRevision();

  emitPotToWinner(winnerId, pot);

  useArchiveStore
    .getState()
    .addEntry(createArchiveEntry([{ playerId: winnerId, amount: pot }], "Quick Win"));
}

function runQuickSplit(winnerIds: string[]): void {
  const handStore = useHandStore.getState();
  const sessionStore = useSessionStore.getState();
  const bettingStore = useBettingStore.getState();
  const settlementStore = useSettlementStore.getState();

  if (handStore.status === "in-progress") {
    return;
  }

  const uniqueWinnerIds = Array.from(new Set(winnerIds));

  if (uniqueWinnerIds.length < 2 || bettingStore.pot <= 0) {
    return;
  }

  pushActionSnapshot("quick-split");

  const orderedWinnerIds = getClockwiseWinnerOrder(
    sessionStore.players,
    sessionStore.dealerSeatIndex,
    uniqueWinnerIds
  );

  const pot = bettingStore.pot;
  const baseShare = Math.floor(pot / orderedWinnerIds.length);
  let remainder = pot % orderedWinnerIds.length;

  const payoutMap = new Map<string, number>();

  orderedWinnerIds.forEach((id) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) {
      remainder -= 1;
    }
    payoutMap.set(id, baseShare + extra);
  });

  const updatedPlayers = clonePlayers(sessionStore.players).map((player) => {
    const payout = payoutMap.get(player.id) ?? 0;

    if (payout > 0) {
      return {
        ...player,
        stack: player.stack + payout,
        status: "winner"
      } satisfies Player;
    }

    return {
      ...player,
      status: player.status === "folded" ? "folded" : "waiting"
    } satisfies Player;
  });

  sessionStore.setPlayers(updatedPlayers);
  bettingStore.setPot(0);
  bettingStore.setCurrentBet(0);

  handStore.setStatus("settlement-confirmed");
  settlementStore.closeDialog();
  settlementStore.markRevision();

  orderedWinnerIds.forEach((winnerId, index) => {
    emitPotToWinner(winnerId, payoutMap.get(winnerId) ?? 0, index * 70);
  });

  useArchiveStore.getState().addEntry(
    createArchiveEntry(
      orderedWinnerIds.map((winnerId) => ({
        playerId: winnerId,
        amount: payoutMap.get(winnerId) ?? 0
      })),
      "Quick Split"
    )
  );
}

function runReopenSettlement(): void {
  const handStore = useHandStore.getState();
  const settlementStore = useSettlementStore.getState();

  if (handStore.status !== "settlement-confirmed") {
    return;
  }

  pushActionSnapshot("reopen-settlement");
  handStore.setStatus("pre-settlement");
  settlementStore.openDialog();
  settlementStore.markRevision();
}

function runSetPlayerCount(count: number): void {
  const sessionStore = useSessionStore.getState();
  const handStore = useHandStore.getState();
  const bettingStore = useBettingStore.getState();
  const settlementStore = useSettlementStore.getState();

  sessionStore.setPlayerCount(count);

  const refreshedSession = useSessionStore.getState();
  const actionOrder = buildActionOrder(
    refreshedSession.players,
    refreshedSession.dealerSeatIndex,
    "preflop"
  );
  const actingPlayerId = actionOrder[0] ?? null;

  sessionStore.setPlayers(setActingStatus(clonePlayers(refreshedSession.players), actingPlayerId));
  handStore.resetForNewHand(actionOrder);
  bettingStore.resetForNewHand();
  settlementStore.resetForNewHand();
  useMotionStore.getState().clearAll();
}

function getAvailableActions(
  actingPlayer: Player | undefined,
  toCall: number,
  handStatus: HandStatus
): AvailablePlayerAction[] {
  if (!actingPlayer || handStatus !== "in-progress") {
    return [];
  }

  if (actingPlayer.status === "all-in") {
    return [];
  }

  if (toCall === 0) {
    return ["fold", "check", "bet", "all-in"];
  }

  return ["fold", "call", "raise", "all-in"];
}

const ACTION_COPY: Record<AvailablePlayerAction, { topLabel: string; mainLabel: string }> = {
  fold: { topLabel: "Fold", mainLabel: "弃牌" },
  check: { topLabel: "Check", mainLabel: "过牌" },
  call: { topLabel: "Call", mainLabel: "跟注" },
  bet: { topLabel: "Bet", mainLabel: "下注" },
  raise: { topLabel: "Raise", mainLabel: "加注" },
  "all-in": { topLabel: "All-in", mainLabel: "全下" }
};

export function useTableController(): TableStateModel {
  const sessionName = useSessionStore((state) => state.sessionName);
  const players = useSessionStore((state) => state.players);
  const actingPlayerId = useHandStore((state) => state.actingPlayerId);
  const street = useHandStore((state) => state.street);
  const status = useHandStore((state) => state.status);
  const historyDepth = useHandStore((state) => state.historyStack.length);
  const pot = useBettingStore((state) => state.pot);
  const currentBet = useBettingStore((state) => state.currentBet);
  const settlementOpen = useSettlementStore((state) => state.isDialogOpen);
  const openSettlement = useSettlementStore((state) => state.openDialog);
  const closeSettlement = useSettlementStore((state) => state.closeDialog);

  const [autosaveReady, setAutosaveReady] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [resumeSavedAtIso, setResumeSavedAtIso] = useState<string | null>(null);

  useEffect(() => {
    useArchiveStore.getState().hydrate();

    const payload = loadLiveSession();

    if (payload?.snapshot) {
      setResumeAvailable(true);
      setResumeSavedAtIso(payload.savedAtIso);
      setAutosaveReady(false);
      return;
    }

    setAutosaveReady(true);
  }, []);

  useEffect(() => {
    if (!autosaveReady) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        saveLiveSession(createPersistedLiveSession());
      }, 180);
    };

    const unsubs = [
      useSessionStore.subscribe(schedule),
      useHandStore.subscribe(schedule),
      useBettingStore.subscribe(schedule),
      useSettlementStore.subscribe(schedule)
    ];

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [autosaveReady]);

  const resumeSession = () => {
    const payload = loadLiveSession();

    if (!payload?.snapshot) {
      setResumeAvailable(false);
      setResumeSavedAtIso(null);
      setAutosaveReady(true);
      return;
    }

    applyTableSnapshot(payload.snapshot);
    setResumeAvailable(false);
    setResumeSavedAtIso(payload.savedAtIso);
    setAutosaveReady(true);
  };

  const discardResumeSnapshot = () => {
    clearLiveSession();
    setResumeAvailable(false);
    setResumeSavedAtIso(null);
    setAutosaveReady(true);
  };

  const actingPlayer = useMemo(
    () => players.find((player) => player.id === actingPlayerId),
    [players, actingPlayerId]
  );

  const toCall = useMemo(() => {
    if (!actingPlayer) {
      return 0;
    }

    return getPlayerToCall(actingPlayer, currentBet);
  }, [actingPlayer, currentBet]);

  const availableActions = useMemo(
    () => getAvailableActions(actingPlayer, toCall, status),
    [actingPlayer, toCall, status]
  );

  const mainActions = useMemo(
    () =>
      availableActions.map((actionId) => ({
        id: actionId,
        topLabel: ACTION_COPY[actionId].topLabel,
        mainLabel: ACTION_COPY[actionId].mainLabel,
        onPress: () => runAction(actionId)
      })),
    [availableActions]
  );

  const utilityActions = useMemo<UtilityActionModel[]>(
    () => [
      {
        id: "undo",
        label: "撤销",
        onPress: runUndo,
        disabled: historyDepth === 0
      },
      {
        id: "edit-hand",
        label: "编辑本手",
        onPress: runEditHand,
        disabled: status === "settlement-confirmed"
      },
      {
        id: "end-hand",
        label: status === "pre-settlement" ? "确认结算" : "结束本手",
        onPress: runEndHand,
        disabled: status === "settlement-confirmed"
      }
    ],
    [historyDepth, status]
  );

  const settlementPlayers = useMemo<SettlementPlayerModel[]>(
    () =>
      players
        .filter((player) => player.status !== "folded")
        .map((player) => ({
          id: player.id,
          name: player.name,
          stackLabel: formatChips(player.stack),
          status: player.status
        })),
    [players]
  );

  return {
    sessionName,
    playerCount: players.length,
    players,
    actingPlayerId,
    pot,
    street,
    status,
    toCall,
    mainActions,
    utilityActions,
    canOpenSettlement: status !== "in-progress",
    settlementOpen,
    settlementPlayers,
    canSettlementUndo: historyDepth > 0,
    canReopenSettlement: status === "settlement-confirmed",
    autosaveReady,
    resumeAvailable,
    resumeSavedAtIso,
    setPlayerCount: runSetPlayerCount,
    openSettlement,
    closeSettlement,
    undoLastAction: runUndo,
    editHand: runEditHand,
    quickWin: runQuickWin,
    quickSplit: runQuickSplit,
    reopenSettlement: runReopenSettlement,
    resumeSession,
    discardResumeSnapshot
  };
}

export function debugRunTableAction(actionType: TableActionType): void {
  switch (actionType) {
    case "fold":
    case "check":
    case "call":
    case "bet":
    case "raise":
    case "all-in":
      runAction(actionType);
      return;
    case "undo-last-action":
      runUndo();
      return;
    case "edit-hand":
      runEditHand();
      return;
    case "quick-win": {
      const first = useSessionStore
        .getState()
        .players.find((player) => player.status !== "folded");
      if (first) {
        runQuickWin(first.id);
      }
      return;
    }
    case "quick-split": {
      const ids = useSessionStore
        .getState()
        .players.filter((player) => player.status !== "folded")
        .slice(0, 2)
        .map((player) => player.id);
      if (ids.length >= 2) {
        runQuickSplit(ids);
      }
      return;
    }
    case "reopen-settlement":
      runReopenSettlement();
      return;
    case "end-hand":
      runEndHand();
      return;
    default:
      return;
  }
}
