import type { TableSeatPlayer } from "@/components/player/types";

export type SeatCoordinate = {
  xPercent: number;
  yPercent: number;
};

const SAMPLE_NAMES = [
  "You",
  "Alex",
  "Maya",
  "Chen",
  "Riley",
  "Jordan",
  "Nora",
  "Ethan",
  "Liam",
  "Sofia"
];

const POSITION_LABELS = [
  "HERO",
  "SB",
  "BB",
  "UTG",
  "UTG+1",
  "LJ",
  "HJ",
  "CO",
  "BTN",
  "MP"
];

const STACK_LABELS = [
  "$12,400",
  "$8,900",
  "$6,300",
  "$10,200",
  "$7,750",
  "$15,100",
  "$9,850",
  "$11,450",
  "$5,600",
  "$13,000"
];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

export function clampPlayerCount(playerCount: number): number {
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, playerCount));
}

export function getSeatCoordinates(playerCount: number, rotation = 0): SeatCoordinate[] {
  const safeCount = clampPlayerCount(playerCount);
  const step = (Math.PI * 2) / safeCount;

  return Array.from({ length: safeCount }, (_, seatIndex) => {
    const angle = Math.PI / 2 + rotation + step * seatIndex;
    const xPercent = 50 + Math.cos(angle) * 41;
    const yPercent = 50 + Math.sin(angle) * 34;

    return { xPercent, yPercent };
  });
}

export function getPlayerSeatCoordinates(
  players: readonly Pick<TableSeatPlayer, "seatIndex" | "seatCount">[],
  rotation = 0
): SeatCoordinate[] {
  return players.map((player, index) => {
    const coordinates = getSeatCoordinates(player.seatCount ?? players.length, rotation);
    return coordinates[player.seatIndex ?? index];
  });
}

// Clockwise around two evenly spaced rails. Fixed room seats stay fixed even
// if a player leaves; unlike the desktop ellipse, this never grows the viewport.
export function getMobileSeatCoordinates(
  players: readonly Pick<TableSeatPlayer, "seatIndex" | "seatCount">[],
  width: number,
  height: number,
  seatWidth: number,
  seatHeight: number
): SeatCoordinate[] {
  const count = clampPlayerCount(players[0]?.seatCount ?? players.length);
  const leftCount = Math.ceil(count / 2);
  const rightCount = count - leftCount;
  // The first render precedes ResizeObserver. Keep that frame on the felt.
  const xInset = (seatWidth / 2 + 3) / (width > 0 ? width : 320) * 100;
  const yInset = (seatHeight / 2 + 3) / (height > 0 ? height : 240) * 100;
  const points = Array.from({ length: count }, (_, index) => {
    if (count === 2) return { xPercent: 50, yPercent: index === 0 ? 100 - yInset : yInset };
    const left = index < leftCount;
    const row = left ? leftCount - 1 - index : index - leftCount;
    const rows = left ? leftCount : rightCount;
    return {
      xPercent: left ? xInset : 100 - xInset,
      yPercent: rows === 1 ? 50 : yInset + row * (100 - 2 * yInset) / (rows - 1)
    };
  });
  return players.map((player, index) => points[player.seatIndex ?? index]);
}

// Portrait tables reserve the widest vertical gap for the pot and board.
export function getPortraitTableLayout(playerCount: number) {
  const safeCount = clampPlayerCount(playerCount);
  const rotation = safeCount % 4 === 0 ? Math.PI / safeCount : 0;
  const rows = [...new Set(getSeatCoordinates(safeCount, rotation).map(({ yPercent }) => Math.round(yPercent * 1000) / 1000))].sort((a, b) => a - b);
  const gaps = rows.slice(1).map((row, index) => ({ gap: row - rows[index], centerYPercent: (row + rows[index]) / 2 }));
  gaps.sort((a, b) => b.gap - a.gap || Math.abs(a.centerYPercent - 50) - Math.abs(b.centerYPercent - 50));
  return { rotation, centerYPercent: gaps[0].centerYPercent, rowGapPercent: gaps[0].gap };
}

export function fitSeatCoordinates(coordinates: readonly SeatCoordinate[], tableWidth: number, seatWidths: readonly number[]): SeatCoordinate[] {
  if (tableWidth <= 0) return [...coordinates];
  const fitted = coordinates.map((point, index) => {
    const margin = ((seatWidths[index] ?? 0) / 2 + 4) / tableWidth * 100;
    return { ...point, xPercent: Math.max(margin, Math.min(100 - margin, point.xPercent)) };
  });
  // Odd player counts share a top row. Keep these two cards apart on narrow tables.
  for (let i = 0; i < fitted.length; i++) {
    for (let j = i + 1; j < fitted.length; j++) {
      if (Math.abs(fitted[i].yPercent - fitted[j].yPercent) > 0.01) continue;
      const spacing = ((seatWidths[i] ?? 0) / 2 + (seatWidths[j] ?? 0) / 2 + 8) / tableWidth * 100;
      if (Math.abs(fitted[i].xPercent - fitted[j].xPercent) >= spacing) continue;
      const [left, right] = fitted[i].xPercent < fitted[j].xPercent ? [i, j] : [j, i];
      fitted[left].xPercent = 50 - spacing / 2;
      fitted[right].xPercent = 50 + spacing / 2;
    }
  }
  return fitted;
}

export function getMinimumTableHeight({ coordinates, tableWidth, seatWidths, seatHeights, centerHeight = 0, centerRowGapPercent }: {
  coordinates: readonly SeatCoordinate[];
  tableWidth: number;
  seatWidths: readonly number[];
  seatHeights: readonly number[];
  centerHeight?: number;
  centerRowGapPercent?: number;
}): number {
  let height = centerHeight && centerRowGapPercent
    ? (centerHeight + Math.max(0, ...seatHeights) + 24) / centerRowGapPercent * 100
    : 0;
  for (let i = 0; i < coordinates.length; i++) {
    for (let j = i + 1; j < coordinates.length; j++) {
      const horizontalDistance = Math.abs(coordinates[i].xPercent - coordinates[j].xPercent) / 100 * tableWidth;
      const verticalDistance = Math.abs(coordinates[i].yPercent - coordinates[j].yPercent);
      const widths = ((seatWidths[i] ?? 0) + (seatWidths[j] ?? 0)) / 2;
      if (horizontalDistance < widths + 8 && verticalDistance > 0.01) {
        height = Math.max(height, (((seatHeights[i] ?? 0) + (seatHeights[j] ?? 0)) / 2 + 8) / verticalDistance * 100);
      }
    }
  }
  return height;
}

export function buildPlaceholderPlayers(playerCount: number): TableSeatPlayer[] {
  const safeCount = clampPlayerCount(playerCount);

  return Array.from({ length: safeCount }, (_, index) => ({
    id: `seat-${index + 1}`,
    name: SAMPLE_NAMES[index],
    stackLabel: STACK_LABELS[index],
    positionLabel: POSITION_LABELS[index],
    isHero: index === 0,
    isActive: index === 0,
    status: index === 0 ? "acting" : "waiting"
  }));
}
