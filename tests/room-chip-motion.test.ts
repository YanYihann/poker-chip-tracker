import assert from "node:assert/strict";
import { test } from "node:test";
import type { RoomState } from "../src/features/rooms/api";
import { getRoomChipMotions } from "../src/features/table/room-chip-motion";

function room(): RoomState {
  return {
    room: { id: "room-a", code: "1234", mode: "local", status: "active", hostUserId: "alex", maxPlayers: 2, createdAtIso: "", startedAtIso: "", smallBlind: 100, bigBlind: 200, startingStack: 2000, currentHandNumber: 1, dealerSeat: 0 },
    players: ["alex", "blake"].map((userId, seatIndex) => ({ id: userId, userId, displayName: userId, avatarUrl: null, seatIndex, isHost: seatIndex === 0, isReady: true, isConnected: true, stack: 1800, currentBet: 200, status: "acting", positionLabel: null, joinedAtIso: "" })),
    me: null, canStart: false,
    game: { handId: "hand-1", handNumber: 1, street: "flop", status: "in-progress", potTotal: 400, currentBet: 0, activeSeat: 0, activePlayerUserId: "alex", dealerSeat: 0, sbSeat: 0, bbSeat: 1, isMyTurn: false, legalActions: [], toCall: 0, minBet: 200, minRaiseDelta: 200, canSettle: false, canDecideNextHand: false, myHoleCards: [], boardCards: [], lastAction: null, eligibleWinnerUserIds: [], lastSettlement: null }
  };
}

test("joining, duplicate polling and changing rooms do not replay wagers", () => {
  const state = room();
  assert.deepEqual(getRoomChipMotions(null, state), []);
  assert.deepEqual(getRoomChipMotions(state, null), []);
  assert.deepEqual(getRoomChipMotions(state, structuredClone(state)), []);
  const other = structuredClone(state);
  other.room.id = "room-b";
  other.players[0].stack -= 200;
  assert.deepEqual(getRoomChipMotions(state, other), []);
});

test("any device sees debits from both players, including an all-in", () => {
  for (const mode of ["local", "online"] as const) {
    const previous = room();
    previous.room.mode = mode;
    const next = structuredClone(previous);
    next.players[0].stack -= 400;
    next.players[1].stack = 0;
    assert.deepEqual(getRoomChipMotions(previous, next), [
      { kind: "chip-to-pot", sourcePlayerId: "alex", amount: 400, delayMs: 0 },
      { kind: "chip-to-pot", sourcePlayerId: "blake", amount: 1800, delayMs: 70 }
    ]);
  }
});

test("a wager which advances the street animates even after currentBet clears", () => {
  const previous = room();
  const next = structuredClone(previous);
  next.game!.street = "turn";
  next.players[0].stack -= 200;
  next.players.forEach((player) => { player.currentBet = 0; });
  assert.equal(getRoomChipMotions(previous, next)[0].amount, 200);
});

test("checks, folds, refunds and standalone payouts do not create wager animations", () => {
  const previous = room();
  const next = structuredClone(previous);
  next.players[0].status = "folded";
  next.players[1].stack += 100;
  assert.deepEqual(getRoomChipMotions(previous, next), []);
  next.players[1].stack = previous.players[1].stack + 400;
  next.game!.status = "settled";
  next.game!.lastSettlement = { entries: [{ userId: "blake", displayName: "blake", amountWon: 400, netChange: 200, handRankCode: null, holeCards: [], bestFiveCards: [] }] };
  assert.deepEqual(getRoomChipMotions(previous, next), []);
});

test("the final call animates when an online all-in pays out in the same response", () => {
  const previous = room();
  const next = structuredClone(previous);
  next.game!.status = "settled";
  next.players[0].stack = 3600;
  next.players[1].stack = 0;
  next.game!.lastSettlement = { entries: [{ userId: "alex", displayName: "alex", amountWon: 3600, netChange: 1600, handRankCode: null, holeCards: [], bestFiveCards: [] }] };
  assert.deepEqual(getRoomChipMotions(previous, next).map(({ amount }) => amount), [1800, 1800]);
  assert.deepEqual(getRoomChipMotions(next, structuredClone(next)), []);
});

test("the next hand animates only posted blinds; skipped hands are not replayed", () => {
  const previous = room();
  previous.game!.status = "settled";
  const next = structuredClone(previous);
  next.game = { ...next.game!, status: "in-progress", handId: "hand-2", handNumber: 2, lastSettlement: null };
  next.players[0].currentBet = 100;
  next.players[1].currentBet = 200;
  assert.deepEqual(getRoomChipMotions(previous, next).map(({ amount }) => amount), [100, 200]);
  next.game.handNumber = 3;
  assert.deepEqual(getRoomChipMotions(previous, next), []);
});
