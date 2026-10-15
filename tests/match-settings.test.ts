import assert from "node:assert/strict";
import test from "node:test";
import { MATCH_TIERS, matchOptionsSchema } from "../server/src/modules/matchmaking/matchmaking.settings";
import { DEFAULT_MATCH_OPTIONS, MATCH_TIER_LABELS } from "../src/features/matchmaking/settings";

test("matching defaults and all public stakes use valid chip and blind settings", () => {
  assert.deepEqual(matchOptionsSchema.parse({}), DEFAULT_MATCH_OPTIONS);
  assert.deepEqual(Object.keys(MATCH_TIERS), Object.keys(MATCH_TIER_LABELS));
  for (const tier of Object.keys(MATCH_TIERS)) for (let maxPlayers = 2; maxPlayers <= 8; maxPlayers++) {
    assert.equal(matchOptionsSchema.safeParse({ tier, maxPlayers }).success, true);
  }
  assert.deepEqual(Object.values(MATCH_TIERS).map((s) => [s.startingStack, s.smallBlind, s.bigBlind]), [[10000, 100, 200], [50000, 500, 1000], [100000, 1000, 2000]]);
});

test("invalid matching sizes and tiers are rejected at the API boundary", () => {
  for (const input of [{ maxPlayers: 1 }, { maxPlayers: 9 }, { maxPlayers: 2.5 }, { maxPlayers: "2" }, { tier: "unknown" }, { tier: null }]) assert.equal(matchOptionsSchema.safeParse(input).success, false);
});
