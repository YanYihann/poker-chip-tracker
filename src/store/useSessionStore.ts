import { create } from "zustand";

import { assignPositions } from "@/features/table/rules";
import { clampPlayerCount, MAX_PLAYERS, MIN_PLAYERS } from "@/lib/table-layout";
import type { Player, SessionSlice } from "@/types/domain";

function buildMockPlayers(playerCount: number): Player[] {
  const safeCount = clampPlayerCount(playerCount);

  const basePlayers = Array.from({ length: safeCount }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `玩家 ${index+1}`,
    seatIndex: index,
    stack: 2000,
    currentBet: 0,
    totalInvestedThisHand: 0,
    status: index === 0 ? "acting" : "waiting",
    isHero: index === 0
  })) satisfies Player[];

  return assignPositions(basePlayers, 0);
}

function createInitialSessionSlice(playerCount = 4): SessionSlice {
  return {
    sessionId: `local-${Date.now()}`,
    sessionName: "Local Table",
    startedAtIso: new Date().toISOString(),
    dealerSeatIndex: 0,
    players: buildMockPlayers(playerCount)
  };
}

type SessionStore = SessionSlice & {
  setSessionName: (name: string) => void;
  setPlayers: (players: Player[]) => void;
  setPlayerCount: (playerCount: number) => void;
  rotateDealer: () => void;
  resetForNewHand: () => void;
  applySnapshot: (slice: SessionSlice) => void;
};

const INITIAL_SESSION = createInitialSessionSlice();

export const useSessionStore = create<SessionStore>((set, get) => ({
  ...INITIAL_SESSION,
  setSessionName: (name) => {
    set({ sessionName: name });
  },
  setPlayers: (players) => {
    set({ players });
  },
  setPlayerCount: (playerCount) => {
    const safeCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, playerCount));
    const players = buildMockPlayers(safeCount);

    set({
      players,
      dealerSeatIndex: 0,
      ledger: undefined
    });
  },
  rotateDealer: () => {
    const { players, dealerSeatIndex } = get();
    const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
    const funded = sorted.filter((p) => p.stack > 0);
    const nextDealer = funded.find((p) => p.seatIndex > dealerSeatIndex)?.seatIndex ?? funded[0]?.seatIndex ?? 0;

    set({
      dealerSeatIndex: nextDealer,
      players: assignPositions(players, nextDealer)
    });
  },
  resetForNewHand: () => {
    const { players, dealerSeatIndex } = get();
    const resetPlayers = players.map((player) => ({
      ...player,
      currentBet: 0,
      totalInvestedThisHand: 0,
      status: player.stack <= 0 ? "all-in" : "waiting"
    })) satisfies Player[];

    const withPositions = assignPositions(resetPlayers, dealerSeatIndex).map((player, index) => ({
      ...player,
      status: index === 0 && player.stack > 0 ? "acting" : player.status
    })) satisfies Player[];

    set({ players: withPositions });
  },
  applySnapshot: (slice) => {
    set({
      sessionId: slice.sessionId,
      sessionName: slice.sessionName,
      startedAtIso: slice.startedAtIso,
      dealerSeatIndex: slice.dealerSeatIndex,
      players: slice.players,
      ledger: slice.ledger
    });
  }
}));
