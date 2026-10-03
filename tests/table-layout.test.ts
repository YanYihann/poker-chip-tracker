import assert from "node:assert/strict";
import { test } from "node:test";
import { getAutoSeatIndices, getPlayerSeatCoordinates, getSeatCoordinates, MAX_PLAYERS } from "../src/lib/table-layout";

const selectionCoordinates = getPlayerSeatCoordinates(
  Array.from({ length: MAX_PLAYERS }, (_, seatIndex) => ({ seatIndex, seatCount: MAX_PLAYERS }))
);

for (const [scenario, seats] of [
  ["sparse seats in selection order", [7, 1, 4]],
  ["six auto-assigned seats", getAutoSeatIndices(6)],
  ["a full ten-player table", Array.from({ length: MAX_PLAYERS }, (_, index) => index)]
] as const) {
  test(`local players keep their selected positions with ${scenario}`, () => {
    const seatedCoordinates = getPlayerSeatCoordinates(
      seats.map((seatIndex) => ({ seatIndex, seatCount: MAX_PLAYERS }))
    );
    assert.deepEqual(seatedCoordinates, seats.map((seatIndex) => selectionCoordinates[seatIndex]));
  });
}

test("auto-seating distributes players around all ten seats without duplicate seats", () => {
  assert.deepEqual(getAutoSeatIndices(2), [0, 5]);
  assert.deepEqual(getAutoSeatIndices(6), [0, 1, 3, 5, 6, 8]);
  assert.deepEqual(getAutoSeatIndices(10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let count = 2; count <= MAX_PLAYERS; count += 1) {
    const seats = getAutoSeatIndices(count);
    const gaps = seats.map((seat, index) => (seats[(index + 1) % count] - seat + MAX_PLAYERS) % MAX_PLAYERS);
    assert.equal(new Set(seats).size, count);
    assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1);
  }
});

test("online players without fixed seats retain the existing evenly spaced layout", () => {
  for (let count = 2; count <= MAX_PLAYERS; count += 1) {
    assert.deepEqual(
      getPlayerSeatCoordinates(Array.from({ length: count }, () => ({}))),
      getSeatCoordinates(count)
    );
  }
});
