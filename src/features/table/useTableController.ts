import { useEffect, useMemo, useState } from "react";

import {
  loadLiveSession,
  clearLiveSession,
  saveLiveSession
} from "@/features/persistence/storage";
import {
  buildActionOrder,
  assignPositions as assignLocalPositions,
  findPlayer,
  getActionablePlayers,
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

import { buildContributionPots, legalBettingActions, minimumRaiseTo, splitPotClockwise } from "../../../server/src/modules/rooms/betting-round";

const STREET_SEQUENCE: Street[] = ["preflop", "flop", "turn", "river", "showdown"];

export type MainActionModel = {
  id: AvailablePlayerAction;
  topLabel: string;
  mainLabel: string;
  onPress: () => void;
};

export type UtilityActionModel = {
  id: "undo" | "edit-hand" | "end-hand" | "next-hand" | "reopen";
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
  settlementPotLabel: string;
  minRaiseTo: number;
  setActionAmount: (amount: number) => void;
  canSettlementUndo: boolean;
  canReopenSettlement: boolean;
  lastActionType?: TableActionType;
  lastActionPlayerName: string | null;
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

function recordResponse(playerId: string, previousBet: number): void {
  const hand = useHandStore.getState();
  const betting = useBettingStore.getState();
  const session = useSessionStore.getState();
  const actionable = getActionablePlayers(session.players);
  const raised = betting.currentBet > previousBet;
  let order = hand.actionOrder.filter((id) => id !== playerId && actionable.some((p) => p.id === id));
  if (raised) {
    const clockwise = [...session.players].sort((a,b) => a.seatIndex - b.seatIndex);
    const actorIndex = clockwise.findIndex((p) => p.id === playerId);
    order = Array.from({length: clockwise.length - 1}, (_,i) => clockwise[(actorIndex+i+1)%clockwise.length])
      .filter((p) => actionable.some((a) => a.id === p.id) && p.currentBet < betting.currentBet).map((p) => p.id);
  }
  hand.setActedAtBet({ ...hand.actedAtBet, [playerId]: betting.currentBet });
  hand.setActionOrder(order);
}

function refundUncalledChips(): void {
  const session = useSessionStore.getState();
  const betting = useBettingStore.getState();
  const pots = buildContributionPots(session.players.map((p) => ({playerId:p.id, amount:p.totalInvestedThisHand})));
  const uncalled = pots.filter((p) => p.participants.length === 1);
  if (!uncalled.length) return;
  session.setPlayers(session.players.map((p) => {
    const refund = uncalled.filter((pot) => pot.participants[0] === p.id).reduce((sum, pot) => sum + pot.amount, 0);
    return {...p, stack:p.stack + refund, totalInvestedThisHand:p.totalInvestedThisHand-refund};
  }));
  betting.setPot(betting.pot - uncalled.reduce((sum,p) => sum+p.amount,0));
}

function settleRoundIfNeeded(): void {
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
    refundUncalledChips();
    settlementStore.openDialog();
    return;
  }

  const actionable = getActionablePlayers(players);
  const pending = handStore.actionOrder.filter((id) => actionable.some((p) => p.id === id));
  if (pending.length > 0 && (actionable.length > 1 || actionable.some((p) => getPlayerToCall(p, bettingStore.currentBet) > 0))) {
    const nextActingPlayerId = pending[0];
    handStore.setActionOrder(pending);
    sessionStore.setPlayers(setActingStatus(players, nextActingPlayerId));
    return;
  }
  if (actionable.length <= 1) {
    handStore.setStreet("showdown");
    handStore.setStatus("pre-settlement");
    handStore.setActingPlayerId(null);
    sessionStore.setPlayers(setActingStatus(players, null));
    refundUncalledChips();
    settlementStore.openDialog();
    return;
  }

  const nextStreet = getNextStreet(handStore.street);

  if (!nextStreet || nextStreet === "showdown") {
    handStore.setStreet("showdown");
    handStore.setStatus("pre-settlement");
    handStore.setActingPlayerId(null);
    sessionStore.setPlayers(setActingStatus(players, null));
    refundUncalledChips();
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
  bettingStore.setLastAggressiveAmount(bettingStore.minBet);
  handStore.setActedAtBet({});
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

let requestedActionAmount = 0;

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
  const legal = getAvailableActions(actingPlayer, toCall, handStore.status);
  if (!legal.includes(actionType)) return;

  if (actionType === "fold") {
    if (!pushReversibleSnapshot(actionType)) {
      return;
    }

    const foldedPlayers: Player[] = clonePlayers(sessionStore.players).map((player) =>
      player.id === actingPlayer.id ? { ...player, status: "folded" } : player
    );

    sessionStore.setPlayers(foldedPlayers);
    recordResponse(actingPlayer.id, bettingStore.currentBet);
    settleRoundIfNeeded();
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
    recordResponse(actingPlayer.id, bettingStore.currentBet);
    settleRoundIfNeeded();
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

    recordResponse(actingPlayer.id, bettingStore.currentBet);
    settleRoundIfNeeded();
    return;
  }

  if (actionType === "bet") {
    if (bettingStore.currentBet !== 0) return;

    const betAmount = requestedActionAmount || bettingStore.minBet;
    if (!Number.isSafeInteger(betAmount) || betAmount < bettingStore.minBet || betAmount > actingPlayer.stack) return;

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

    recordResponse(actingPlayer.id, bettingStore.currentBet);
    settleRoundIfNeeded();
    return;
  }

  if (actionType === "raise") {
    const raiseTo = requestedActionAmount || minimumRaiseTo(bettingStore.currentBet, bettingStore.minRaiseDelta, bettingStore.minBet);
    if (!Number.isSafeInteger(raiseTo) || raiseTo < minimumRaiseTo(bettingStore.currentBet, bettingStore.minRaiseDelta, bettingStore.minBet) || raiseTo > actingPlayer.stack + actingPlayer.currentBet) return;
    const appliedAmount = raiseTo - actingPlayer.currentBet;

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

    recordResponse(actingPlayer.id, bettingStore.currentBet);
    settleRoundIfNeeded();
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
    if (nextCurrentBet - bettingStore.currentBet >= bettingStore.minRaiseDelta) bettingStore.setLastAggressiveAmount(nextCurrentBet - bettingStore.currentBet);
    emitChipToPot(actingPlayer.id, allInAmount);

    recordResponse(actingPlayer.id, bettingStore.currentBet);
    settleRoundIfNeeded();
  }
}

function runUndo(): void {
  const snapshot = useHandStore.getState().popSnapshot();

  if (!snapshot) {
    return;
  }

  if (["quick-win", "quick-split"].includes(useHandStore.getState().lastActionType ?? "")) useArchiveStore.getState().removeLatestEntry();
  applyTableSnapshot(snapshot);
  useMotionStore.getState().clearAll();
}

function runEditHand(): void {
  if (useHandStore.getState().status === "pre-settlement") useSettlementStore.getState().openDialog();
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

function runEndHand(): void { runEditHand(); }

function getNextSettlementPot() {
  const players = useSessionStore.getState().players;
  return buildContributionPots(players.map((p) => ({playerId:p.id, amount:p.totalInvestedThisHand})))[0];
}

function runQuickWin(winnerId: string): void { runQuickSplit([winnerId]); }

function runQuickSplit(winnerIds: string[]): void {
  const hand = useHandStore.getState();
  const session = useSessionStore.getState();
  const betting = useBettingStore.getState();
  const settlement = useSettlementStore.getState();
  if (hand.status !== "pre-settlement") return;
  const pot = getNextSettlementPot();
  if (!pot) return;
  const ids = [...new Set(winnerIds)];
  const winners = session.players.filter((p) => ids.includes(p.id) && pot.participants.includes(p.id) && p.status !== "folded");
  if (!winners.length || winners.length !== ids.length) return;
  pushActionSnapshot(ids.length === 1 ? "quick-win" : "quick-split");
  const payouts = splitPotClockwise(pot.amount, winners.map((p) => ({playerId:p.id,seatIndex:p.seatIndex})),session.dealerSeatIndex);
  const entry = createArchiveEntry(winners.map((p) => ({playerId:p.id,amount:payouts[p.id]})), "Pot settlement");
  entry.totalPot = pot.amount;
  session.setPlayers(session.players.map((p) => ({
    ...p, stack:p.stack+(payouts[p.id]??0),
    totalInvestedThisHand:Math.max(0,p.totalInvestedThisHand-(pot.participants.includes(p.id)?pot.contribution:0)),
    currentBet:0, status:p.status === "folded" ? "folded" : payouts[p.id] ? "winner" : "waiting"
  })));
  betting.setPot(betting.pot-pot.amount);
  betting.setCurrentBet(0);
  hand.setStatus(betting.pot-pot.amount === 0 ? "settlement-confirmed" : "pre-settlement");
  settlement.markRevision();
  if (betting.pot-pot.amount === 0) settlement.closeDialog();
  winners.forEach((p,i) => emitPotToWinner(p.id,payouts[p.id],i*50));
  useArchiveStore.getState().addEntry(entry);
}

function runReopenSettlement(): void {
  if (useHandStore.getState().status !== "settlement-confirmed") return;
  runUndo();
  useSettlementStore.getState().openDialog();
}

export function startLocalHand(rotate = false): void {
  const session = useSessionStore.getState();
  if (rotate) session.rotateDealer();
  const refreshed = useSessionStore.getState();
  const players: Player[] = refreshed.players.map((p) => ({...p,currentBet:0,totalInvestedThisHand:0,status:p.stack>0?"waiting":"folded"}));
  const funded = players.filter((p) => p.stack > 0).sort((a,b) => a.seatIndex-b.seatIndex);
  if (funded.length < 2) return;
  const dealer = funded.findIndex((p) => p.seatIndex === refreshed.dealerSeatIndex);
  const btn = dealer >= 0 ? dealer : 0;
  const sb = funded.length === 2 ? funded[btn] : funded[(btn+1)%funded.length];
  const bb = funded[(funded.indexOf(sb)+1)%funded.length];
  const minBet = useBettingStore.getState().minBet;
  const posted = players.map((p) => {
    const amount = p.id === sb.id ? Math.min(p.stack,Math.floor(minBet/2)) : p.id === bb.id ? Math.min(p.stack,minBet) : 0;
    return {...p, stack:p.stack-amount,currentBet:amount,totalInvestedThisHand:amount,status:p.stack>0 && p.stack===amount?"all-in":p.status} as Player;
  });
  const order = buildActionOrder(posted.filter((p) => p.status !== "folded"),funded[btn].seatIndex,"preflop");
  const positioned = assignLocalPositions(posted.filter((p) => p.status !== "folded"), funded[btn].seatIndex);
  session.applySnapshot({...refreshed,dealerSeatIndex:funded[btn].seatIndex,players:setActingStatus(posted.map((p) => positioned.find((active) => active.id === p.id) ?? {...p,position:undefined}),order[0]??null)});
  useHandStore.getState().resetForNewHand(order);
  useBettingStore.getState().resetForNewHand();
  useBettingStore.getState().setPot(posted.reduce((sum,p) => sum+p.currentBet,0));
  useBettingStore.getState().setCurrentBet(minBet);
  useSettlementStore.getState().resetForNewHand();
  useMotionStore.getState().clearAll();
  requestedActionAmount = 0;
  settleRoundIfNeeded();
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

  if (actingPlayer.status === "all-in" || actingPlayer.status === "folded") {
    return [];
  }

  const betting = useBettingStore.getState();
  return legalBettingActions({
    stack:actingPlayer.stack,playerBet:actingPlayer.currentBet,currentBet:betting.currentBet,
    minRaiseDelta:betting.minRaiseDelta,bigBlind:betting.minBet,
    lastActedBet:useHandStore.getState().actedAtBet?.[actingPlayer.id],
    canOpponentRespond:getActionablePlayers(useSessionStore.getState().players).some((p) => p.id !== actingPlayer.id)
  });
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
  const historyStack = useHandStore((state) => state.historyStack);
  const lastActionType = useHandStore((state) => state.lastActionType);
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
        flush();
      }, 180);
    };

    const unsubs = [
      useSessionStore.subscribe(schedule),
      useHandStore.subscribe(schedule),
      useBettingStore.subscribe(schedule),
      useSettlementStore.subscribe(schedule)
    ];

    const flush = () => {
      const hand = useHandStore.getState();
      if (!useSessionStore.getState().players.some((p) => p.totalInvestedThisHand > 0) && hand.historyStack.length === 0 && hand.status === "in-progress") return;
      saveLiveSession(createPersistedLiveSession());
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
      if (timer) clearTimeout(timer);
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
        id: "next-hand", label: "下一手", onPress: () => startLocalHand(true),
        disabled: status !== "settlement-confirmed" || players.filter((p) => p.stack > 0).length < 2
      },
      {
        id: "reopen", label: "重开结算", onPress: runReopenSettlement,
        disabled: status !== "settlement-confirmed" || historyDepth === 0
      }
    ],
    [historyDepth, status, players]
  );

  const settlementPlayers = useMemo<SettlementPlayerModel[]>(
    () =>
      players
        .filter((player) => player.status !== "folded" && (getNextSettlementPot()?.participants.includes(player.id) ?? false))
        .map((player) => ({
          id: player.id,
          name: player.name,
          stackLabel: formatChips(player.stack),
          status: player.status
        })),
    [players]
  );

  const lastActionPlayerName = useMemo(() => {
    if (!lastActionType || historyStack.length === 0) {
      return null;
    }

    const lastSnapshot = historyStack[historyStack.length - 1];
    const lastActorId = lastSnapshot?.hand.actingPlayerId ?? null;
    if (!lastActorId) {
      return null;
    }

    return players.find((player) => player.id === lastActorId)?.name ?? null;
  }, [historyStack, lastActionType, players]);

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
    settlementPotLabel: formatChips(getNextSettlementPot()?.amount ?? 0),
    minRaiseTo: minimumRaiseTo(currentBet, useBettingStore.getState().minRaiseDelta, useBettingStore.getState().minBet),
    setActionAmount: (amount) => { requestedActionAmount = amount; },
    canSettlementUndo: historyDepth > 0,
    canReopenSettlement: status === "settlement-confirmed",
    lastActionType,
    lastActionPlayerName,
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
