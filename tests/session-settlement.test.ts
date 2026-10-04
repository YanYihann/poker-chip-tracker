import assert from "node:assert/strict";
import test from "node:test";
import { buildChipTransfers, createLocalLedger, recordLocalPayout, summarizeLocalSession, summarizeOnlineSession, type LocalSessionLedger } from "../src/features/settlement/session-summary";
import { startLocalHand, debugRunTableAction, endLocalSession } from "../src/features/table/useTableController";
import { createTableSnapshotFromStores, applyTableSnapshot } from "../src/features/table/snapshot";
import { useSessionStore } from "../src/store/useSessionStore";
import { useArchiveStore } from "../src/store/useArchiveStore";
import { useBettingStore } from "../src/store/useBettingStore";
import type { SessionDetail } from "../src/features/auth/api";

function setup(stacks = [2000, 2000]) {
  const store = useSessionStore.getState();
  store.setPlayerCount(stacks.length);
  const players = useSessionStore.getState().players.map((p, i) => ({ ...p, stack: stacks[i] }));
  store.applySnapshot({ ...useSessionStore.getState(), sessionId: "test-session", players, ledger: createLocalLedger(players) });
  useArchiveStore.getState().clearEntries();
  startLocalHand();
}

test("local report spans hands, refunds uncalled bets, reverses reopened payouts and locks once ended", () => {
  setup();
  assert.equal(endLocalSession(), null);
  debugRunTableAction("fold"); debugRunTableAction("quick-win");
  const first = useSessionStore.getState().ledger!.hands[0];
  assert.equal(first.potTotal, 200);
  assert.deepEqual(first.results.map((p) => p.netChange), [-100, 100]);
  debugRunTableAction("reopen-settlement");
  assert.equal(useSessionStore.getState().ledger!.hands.length, 0);
  debugRunTableAction("quick-win");
  assert.equal(useSessionStore.getState().ledger!.hands.length, 1);
  startLocalHand(true);
  debugRunTableAction("fold"); debugRunTableAction("quick-win");
  const snapshot = JSON.parse(JSON.stringify(createTableSnapshotFromStores()));
  useSessionStore.getState().setPlayerCount(4);
  applyTableSnapshot(snapshot);
  const summary = endLocalSession()!;
  assert.equal(summary.hands.length, 2);
  assert.deepEqual(summary.players.map((p) => [p.handsWon, p.endStack, p.netChange]), [[1, 2000, 0], [1, 2000, 0]]);
  assert.deepEqual(buildChipTransfers(summary.players), []);
  assert.equal(useArchiveStore.getState().entries.filter((p) => p.summary).length, 1);
  assert.deepEqual(endLocalSession(), summary);
  debugRunTableAction("undo-last-action"); debugRunTableAction("reopen-settlement"); startLocalHand(true);
  assert.deepEqual(useSessionStore.getState().ledger!.hands, summary.hands);
  assert.equal(useArchiveStore.getState().entries.filter((p) => p.summary).length, 1);
});

test("multiple local side pots produce one hand, with snapshot undo retaining earlier pot payouts", () => {
  setup([1000, 500, 1000]);
  debugRunTableAction("all-in"); debugRunTableAction("call"); debugRunTableAction("call");
  assert.equal(useBettingStore.getState().pot, 2500);
  debugRunTableAction("quick-win");
  assert.equal(useSessionStore.getState().ledger!.hands.length, 0);
  assert.equal(endLocalSession(), null);
  debugRunTableAction("quick-win");
  assert.equal(useSessionStore.getState().ledger!.hands.length, 1);
  debugRunTableAction("reopen-settlement");
  assert.equal(useSessionStore.getState().ledger!.handPayouts["player-1"], 1500);
  debugRunTableAction("quick-win");
  const summary = endLocalSession()!;
  assert.deepEqual(summary.players.map((p) => [p.handsWon, p.endStack, p.netChange]), [[1, 2500, 1500], [0, 0, -500], [0, 0, -1000]]);
  assert.equal(summary.hands[0].results[0].amountWon, 2500);
  assert.equal(summary.hands[0].results.reduce((s, p) => s + p.netChange, 0), 0);
});

test("split-pot winners count once per hand, including a winner with negative net", () => {
  const players = [{ id: "a", name: "A", stack: 300 }, { id: "b", name: "B", stack: 100 }];
  let ledger: LocalSessionLedger = { ...createLocalLedger(players), handStartStacks: { a: 300, b: 100 } };
  ledger = recordLocalPayout(ledger, [{ ...players[0], stack: 100 }, { ...players[1], stack: 100 }], { a: 100, b: 100 }, false);
  ledger = recordLocalPayout(ledger, [{ ...players[0], stack: 200 }, { ...players[1], stack: 200 }], { a: 100, b: 100 }, true);
  const summary = summarizeLocalSession({ sessionId: "split", sessionName: "Split", startedAtIso: "2026-10-04", ledger, players: [{ ...players[0], stack: 200 }, { ...players[1], stack: 200 }] });
  assert.deepEqual(summary.players.map((p) => [p.handsWon, p.netChange]), [[1, -100], [1, 100]]);
  assert.deepEqual(summary.hands[0].results.map((p) => p.amountWon), [200, 200]);
});

test("online report orders hands, includes busted absent players and reconstructs per-hand balances", () => {
  const detail: SessionDetail = {
    session: { id: "session", roomCode: "1234", startedAtIso: "2026-10-04", endedAtIso: "2026-10-04", totalHands: 2 },
    me: { userId: "a", startStack: "1000", endStack: "2500", profitLoss: "1500", handsPlayed: 2 },
    players: [
      { userId: "a", username: "A", startStack: "1000", endStack: "2500", profitLoss: "1500", handsPlayed: 2 },
      { userId: "b", username: "B", startStack: "1000", endStack: "500", profitLoss: "-500", handsPlayed: 2 },
      { userId: "c", username: "C", startStack: "1000", endStack: "0", profitLoss: "-1000", handsPlayed: 1 }
    ],
    hands: [
      { handNumber: 2, potTotal: "1000", results: [{ userId: "a", username: "A", amountWon: "1000", netChange: "500" }, { userId: "b", username: "B", amountWon: "0", netChange: "-500" }] },
      { handNumber: 1, potTotal: "3000", results: [{ userId: "a", username: "A", amountWon: "2000", netChange: "1000" }, { userId: "b", username: "B", amountWon: "1000", netChange: "0" }, { userId: "c", username: "C", amountWon: "0", netChange: "-1000" }] }
    ]
  };
  const report = summarizeOnlineSession(detail);
  assert.deepEqual(report.players.map((p) => p.handsWon), [2, 1, 0]);
  assert.deepEqual(report.hands.map((p) => p.handNumber), [1, 2]);
  assert.deepEqual(report.hands[1].results.map((p) => [p.startStack, p.endStack]), [[2000, 2500], [1000, 500], [0, 0]]);
  assert.deepEqual(buildChipTransfers(report.players), [{ fromPlayerId: "c", toPlayerId: "a", amount: 1000 }, { fromPlayerId: "b", toPlayerId: "a", amount: 500 }]);
});

test("transfers settle every player's net across multiple winners, and reject unbalanced totals", () => {
  const players = [{ id: "a", netChange: 800 }, { id: "b", netChange: 200 }, { id: "c", netChange: -700 }, { id: "d", netChange: -300 }, { id: "e", netChange: 0 }];
  const transfers = buildChipTransfers(players);
  for (const player of players) {
    const received = transfers.filter((p) => p.toPlayerId === player.id).reduce((s, p) => s + p.amount, 0);
    const paid = transfers.filter((p) => p.fromPlayerId === player.id).reduce((s, p) => s + p.amount, 0);
    assert.equal(received - paid, player.netChange);
  }
  assert.deepEqual(buildChipTransfers([{ id: "a", netChange: 10 }]), []);
  assert.deepEqual(buildChipTransfers([{ id: "a", netChange: NaN }]), []);
});
