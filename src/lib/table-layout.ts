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

export function getSeatCoordinates(playerCount: number): SeatCoordinate[] {
  const safeCount = clampPlayerCount(playerCount);
  const step = (Math.PI * 2) / safeCount;

  return Array.from({ length: safeCount }, (_, seatIndex) => {
    const angle = Math.PI / 2 + step * seatIndex;
    const xPercent = 50 + Math.cos(angle) * 41;
    const yPercent = 50 + Math.sin(angle) * 34;

    return { xPercent, yPercent };
  });
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
