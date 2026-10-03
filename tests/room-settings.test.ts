import assert from "node:assert/strict";
import test from "node:test";
import { createRoomSchema } from "../server/src/modules/rooms/room.schemas";

test("room settings accept defaults and a custom uniform stack/blind structure", () => {
  assert.equal(createRoomSchema.safeParse({}).success, true);
  assert.equal(createRoomSchema.safeParse({ startingStack: 5000, smallBlind: 25, bigBlind: 50, maxPlayers: 10 }).success, true);
});

test("room settings reject invalid relationships and unsafe chip values", () => {
  for (const settings of [
    { smallBlind: 300, bigBlind: 200 }, { startingStack: 100, bigBlind: 200 },
    { startingStack: 0 }, { smallBlind: 1.5 }, { bigBlind: -1 },
    { startingStack: Number.MAX_SAFE_INTEGER + 1 }, { maxPlayers: 11 }, { maxPlayers: 1 },
    { smallBlind: 300 }, { startingStack: 100 },
  ]) assert.equal(createRoomSchema.safeParse(settings).success, false, JSON.stringify(settings));
});
