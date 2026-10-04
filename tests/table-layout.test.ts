import assert from "node:assert/strict";
import { test } from "node:test";
import { getPlayerSeatCoordinates, getSeatCoordinates, MAX_PLAYERS } from "../src/lib/table-layout";

const selectionCoordinates = getPlayerSeatCoordinates(
  Array.from({ length: MAX_PLAYERS }, (_, seatIndex) => ({ seatIndex, seatCount: MAX_PLAYERS }))
);

for (const [scenario, seats] of [
  ["sparse seats in selection order", [7, 1, 4]],
  ["six fixed seats", [0, 1, 3, 5, 6, 8]],
  ["a full ten-player table", Array.from({ length: MAX_PLAYERS }, (_, index) => index)]
] as const) {
  test(`fixed-capacity tables keep their selected positions with ${scenario}`, () => {
    const seatedCoordinates = getPlayerSeatCoordinates(
      seats.map((seatIndex) => ({ seatIndex, seatCount: MAX_PLAYERS }))
    );
    assert.deepEqual(seatedCoordinates, seats.map((seatIndex) => selectionCoordinates[seatIndex]));
  });
}

test("online players without fixed seats retain the existing evenly spaced layout", () => {
  for (let count = 2; count <= MAX_PLAYERS; count += 1) {
    assert.deepEqual(
      getPlayerSeatCoordinates(Array.from({ length: count }, () => ({}))),
      getSeatCoordinates(count)
    );
  }
});

test("local tables have exactly the selected count of evenly spaced seats", () => {
  for (let count = 2; count <= MAX_PLAYERS; count++) {
    const points = getPlayerSeatCoordinates(Array.from({ length: count }, (_, seatIndex) => ({ seatIndex, seatCount: count })));
    assert.equal(points.length, count);
    assert.deepEqual(points, getSeatCoordinates(count));
    const angles = points.map(({ xPercent, yPercent }) => Math.atan2((yPercent - 50) / 34, (xPercent - 50) / 41));
    for (let i = 0; i < count; i++) {
      const gap = (angles[(i + 1) % count] - angles[i] + Math.PI * 2) % (Math.PI * 2);
      assert.ok(Math.abs(gap - Math.PI * 2 / count) < 1e-10);
    }
  }
});
