import type { RoomState } from "../rooms/api";
import type { TableMotionEvent } from "../../types/domain";

type ChipMotion = Omit<TableMotionEvent, "id" | "createdAt">;

// Observe authoritative balances so every device animates the same wagers.
// A street change clears currentBet, but the stack still records the debit.
export function getRoomChipMotions(previous: RoomState | null, next: RoomState | null): ChipMotion[] {
  if (!previous || !next || previous.room.id !== next.room.id || !next.game) return [];

  const previousGame = previous.game;
  const sameHand = previousGame && previousGame.handId === next.game.handId && previousGame.handNumber === next.game.handNumber;
  const nextHand = next.game.handNumber === (previousGame?.handNumber ?? 0) + 1;
  if (!sameHand && !nextHand) return [];
  if (sameHand && previousGame.status === "settled") return [];
  if (!sameHand && next.game.status === "settled") return [];

  const motions: ChipMotion[] = [];
  for (const player of next.players) {
    const before = previous.players.find((candidate) => candidate.userId === player.userId);
    if (!before || player.seatIndex === null) continue;
    // Online all-ins can debit and pay out in one response. Remove that
    // payout from the balance comparison so the final wager still animates.
    const payout = sameHand && next.game.status === "settled"
      ? next.game.lastSettlement?.entries.find((entry) => entry.userId === player.userId)?.amountWon ?? 0
      : 0;
    const amount = sameHand ? before.stack - player.stack + payout : player.currentBet;
    if (amount <= 0) continue;
    motions.push({ kind: "chip-to-pot", sourcePlayerId: player.userId, amount, delayMs: motions.length * 70 });
  }
  return motions;
}
