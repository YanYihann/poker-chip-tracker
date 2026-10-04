import assert from "node:assert/strict";
import test from "node:test";
import { includeDeviceSessions } from "../src/features/auth/profile-totals";
import type { ProfilePayload } from "../src/features/auth/api";
import type { SessionSummary } from "../src/features/settlement/session-summary";
import { useArchiveStore } from "../src/store/useArchiveStore";

const zero = { sessions: 0, hands: 0, profit: "0", loss: "0", net: "0" };
const profile: ProfilePayload = { username: "Alex", avatarUrl: null, historyResetAtIso: null,
  totals: { ...zero, sessions: 1, profit: "400", net: "400" }, byMode: { online: { ...zero, sessions: 1, hands: 2, profit: "400", net: "400" }, local: zero } };
function summary(id: string, userId?: string, netChange = -100): SessionSummary {
  return { id, name: "Local", startedAtIso: "2026-10-04T00:00:00.000Z", endedAtIso: "2026-10-04T01:00:00.000Z", historyComplete: true,
    owner: userId ? { userId, playerId: "p1" } : undefined,
    players: [{ id: "p1", name: "Alex", startStack: 2000, endStack: 2000 + netChange, netChange, handsWon: 0 }],
    hands: [{ handNumber: 1, potTotal: 300, results: [{ playerId: "p1", name: "Alex", amountWon: 0, netChange, startStack: 2000, endStack: 2000 + netChange }] }] };
}
test("personal local totals use account-bound seats, exclude anonymous/other accounts and duplicate archives", () => {
  const own = summary("own", "alex");
  const result = includeDeviceSessions(profile, "alex", [own, own, summary("anonymous"), summary("other", "blake"), summary("profit", "alex", 250)]);
  assert.deepEqual(result.byMode.local, { sessions: 2, hands: 2, profit: "250", loss: "100", net: "150" });
  assert.equal(result.totals.net, "550");
  assert.equal(profile.byMode.local.sessions, 0, "stored server totals remain immutable");
  assert.equal("totalAssets" in result, false);
});
test("a server reset also suppresses older device results without suppressing future sessions", () => {
  const cleared = { ...profile, historyResetAtIso: "2026-10-04T01:00:00.000Z", totals: zero, byMode: { online: zero, local: zero } };
  const future = { ...summary("new", "alex", 75), endedAtIso: "2026-10-04T02:00:00.000Z" };
  const result = includeDeviceSessions(cleared, "alex", [summary("old", "alex"), future]);
  assert.equal(result.byMode.local.sessions, 1);
  assert.equal(result.totals.net, "75");
});

test("an eliminated personal seat does not accumulate hands while the remaining players keep playing", () => {
  const ended = summary("busted", "alex", -2000);
  ended.hands.push({ handNumber: 2, potTotal: 300, results: [{ playerId: "p1", name: "Alex", amountWon: 0, netChange: 0, startStack: 0, endStack: 0 }] });
  assert.equal(includeDeviceSessions(profile, "alex", [ended]).byMode.local.hands, 1);
});

test("completed device sessions survive the intermediate hand cap so older personal totals remain counted", () => {
  useArchiveStore.setState({ entries: [], hydrated: true });
  const own = summary("completed", "alex");
  const base = { sessionName: "Local", endedAtIso: own.endedAtIso, playerCount: 2, totalPot: 300, winners: [] };
  useArchiveStore.getState().addEntry({ ...base, id: own.id, summary: own });
  for (let index = 0; index < 220; index++) useArchiveStore.getState().addEntry({ ...base, id: `hand-${index}` });
  const entries = useArchiveStore.getState().entries;
  assert.equal(entries.filter((entry) => !entry.summary).length, 200);
  const totals = includeDeviceSessions(profile, "alex", entries.flatMap((entry) => entry.summary ? [entry.summary] : []));
  assert.equal(totals.byMode.local.net, "-100");
  useArchiveStore.getState().clearEntries();
  assert.equal(useArchiveStore.getState().entries.length, 0);
});
