import assert from "node:assert/strict";
import { test } from "node:test";
import { fitSeatCoordinates, getMinimumTableHeight, getPlayerSeatCoordinates, getPortraitTableLayout, getSeatCoordinates, MAX_PLAYERS } from "../src/lib/table-layout";

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

test("portrait tables keep player cards and the pot apart at phone widths, including revealed cards", () => {
  for (const tableWidth of [280, 335, 432]) {
    for (let count = 2; count <= MAX_PLAYERS; count++) {
      for (const revealed of [false, true]) {
        const width = Math.min(revealed ? 180 : count >= 7 ? 148 : 160, tableWidth / 2 - 8);
        const height = revealed ? 90 : 74;
        const widths = Array(count).fill(width);
        const heights = Array(count).fill(height);
        const layout = getPortraitTableLayout(count);
        const coordinates = fitSeatCoordinates(getSeatCoordinates(count, layout.rotation), tableWidth, widths);
        const tableHeight = getMinimumTableHeight({ coordinates, tableWidth, seatWidths: widths, seatHeights: heights, centerHeight: 164, centerRowGapPercent: layout.rowGapPercent });
        const boxes = coordinates.map(({ xPercent, yPercent }) => ({ x: xPercent / 100 * tableWidth, y: yPercent / 100 * tableHeight }));
        for (let i = 0; i < count; i++) {
          assert.ok(boxes[i].x - width / 2 >= 0 && boxes[i].x + width / 2 <= tableWidth);
          assert.ok(Math.abs(boxes[i].y - layout.centerYPercent / 100 * tableHeight) >= (height + 164) / 2);
          for (let j = i + 1; j < count; j++) {
            assert.ok(Math.abs(boxes[i].x - boxes[j].x) >= width - 0.01 || Math.abs(boxes[i].y - boxes[j].y) >= height - 0.01,
              `${count} players at ${tableWidth}px: seats ${i + 1} and ${j + 1} overlap`);
          }
        }
      }
    }
  }
});
