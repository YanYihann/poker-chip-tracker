import assert from "node:assert/strict";
import { test } from "node:test";
import { fitSeatCoordinates, getMinimumTableHeight, getMobileSeatCoordinates, getPlayerSeatCoordinates, getPortraitTableLayout, getSeatCoordinates, MAX_PLAYERS } from "../src/lib/table-layout";

const selectionCoordinates = getPlayerSeatCoordinates(
  Array.from({ length: MAX_PLAYERS }, (_, seatIndex) => ({ seatIndex, seatCount: MAX_PLAYERS }))
);

test("heads-up phone seats sit inward and leave the central pot and board clear", () => {
  const players = [{ seatIndex: 0, seatCount: 2 }, { seatIndex: 1, seatCount: 2 }];
  for (const height of [230, 258, 350, 580]) {
    const points = getMobileSeatCoordinates(players, 357, height, 156, 56);
    assert.equal(points[0].xPercent, 50);
    assert.equal(points[1].xPercent, 50);
    assert.ok(Math.abs(points[0].yPercent + points[1].yPercent - 100) < 1e-10);
    assert.ok(points[1].yPercent / 100 * height >= 31);
    assert.ok((50 - points[1].yPercent) / 100 * height >= 84 - 0.01);
    if (height >= 350) assert.equal(points[1].yPercent, 14);
  }
});

test("mobile rails fit 2–10 seats and the central board inside small portrait and landscape tables", () => {
  for (const [width, height] of [[302, 258], [357, 350], [412, 580], [292, 230], [391, 275], [568, 290]]) {
    for (let count = 2; count <= 10; count++) {
      const seatWidth = count === 2 || count === 4 ? Math.min(156, width / 2 - 8) : Math.min(140, width / 2 - 54);
      const players = Array.from({ length: count }, (_, seatIndex) => ({ seatIndex, seatCount: count }));
      const initial = getMobileSeatCoordinates(players, 0, 0, 156, count === 2 || count === 4 ? 56 : 44);
      assert.ok(initial.every(({ xPercent, yPercent }) => xPercent > 0 && xPercent < 100 && yPercent > 0 && yPercent < 100), "seats stay on the felt before the first resize measurement");
      const seatHeight = count === 2 || count === 4 ? 56 : 44;
      const points = getMobileSeatCoordinates(players, width, height, seatWidth, seatHeight);
      const boxes = points.map((p) => ({ x: p.xPercent / 100 * width, y: p.yPercent / 100 * height }));
      for (let i = 0; i < count; i++) {
        const a = boxes[i];
        assert.ok(a.x - seatWidth / 2 >= 0 && a.x + seatWidth / 2 <= width);
        assert.ok(a.y - seatHeight / 2 >= 0 && a.y + seatHeight / 2 <= height);
        assert.ok(count === 2 || count === 4 ? Math.abs(a.y - height / 2) >= (seatHeight + 112) / 2 : Math.abs(a.x - width / 2) >= (seatWidth + 94) / 2);
        for (const b of boxes.slice(i + 1)) assert.ok(Math.abs(a.x - b.x) >= seatWidth || Math.abs(a.y - b.y) >= seatHeight - 0.01);
      }
      assert.deepEqual(getMobileSeatCoordinates([players[0], players[count - 1]], width, height, seatWidth, seatHeight), [points[0], points[count - 1]], "leaving players preserve fixed seats");
    }
  }
});

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
