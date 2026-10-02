import type { Player, Position, Street } from "@/types/domain";

const POSITION_SEQUENCE: Record<number, Position[]> = {
  4: ["UTG"], 5: ["UTG", "CO"], 6: ["UTG", "HJ", "CO"],
  7: ["UTG", "MP", "HJ", "CO"], 8: ["UTG", "UTG+1", "MP", "HJ", "CO"],
  9: ["UTG", "UTG+1", "MP", "LJ", "HJ", "CO"],
  10: ["UTG", "UTG+1", "UTG+2", "MP", "LJ", "HJ", "CO"]
};

function sortBySeat(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.seatIndex - b.seatIndex);
}

function getNextIndex(currentIndex: number, total: number): number {
  return (currentIndex + 1) % total;
}

function findSeatIndexByPlayerId(players: Player[], playerId: string): number {
  return players.findIndex((player) => player.id === playerId);
}

function getNextActiveIndex(players: Player[], startIndex: number): number {
  return getNextIndex(startIndex, players.length);
}

export function assignPositions(players: Player[], dealerSeatIndex: number): Player[] {
  const seatSorted = sortBySeat(players);

  if (seatSorted.length < 2) {
    return seatSorted;
  }

  const dealerIndex = seatSorted.findIndex((player) => player.seatIndex === dealerSeatIndex);
  const safeDealerIndex = dealerIndex >= 0 ? dealerIndex : 0;

  if (seatSorted.length === 2) {
    const otherIndex = getNextIndex(safeDealerIndex, seatSorted.length);

    return seatSorted.map((player, index) => {
      if (index === safeDealerIndex) {
        return { ...player, position: "BTN/SB" };
      }

      if (index === otherIndex) {
        return { ...player, position: "BB" };
      }

      return { ...player };
    });
  }

  const sbIndex = getNextActiveIndex(seatSorted, safeDealerIndex);
  const bbIndex = getNextActiveIndex(seatSorted, sbIndex);

  const positionById = new Map<string, Position>();
  positionById.set(seatSorted[safeDealerIndex].id, "BTN");
  positionById.set(seatSorted[sbIndex].id, "SB");
  positionById.set(seatSorted[bbIndex].id, "BB");

  let cursor = bbIndex;
  let positionCursor = 0;

  while (positionById.size < seatSorted.length) {
    cursor = getNextActiveIndex(seatSorted, cursor);
    const playerId = seatSorted[cursor].id;

    if (!positionById.has(playerId)) {
      const labels = POSITION_SEQUENCE[seatSorted.length] ?? [];
      positionById.set(playerId, (labels[positionCursor] ?? "UTG") as Position);
      positionCursor += 1;
    }
  }

  return seatSorted.map((player) => ({
    ...player,
    position: positionById.get(player.id)
  }));
}

export function getActionablePlayers(players: Player[]): Player[] {
  return players.filter((player) => player.status !== "folded" && player.status !== "all-in" && player.stack > 0);
}

export function buildActionOrder(
  players: Player[],
  dealerSeatIndex: number,
  street: Street
): string[] {
  const seatSorted = sortBySeat(players);
  const actionable = getActionablePlayers(seatSorted);

  if (actionable.length <= 1) {
    return actionable.map((player) => player.id);
  }

  const dealerIndex = seatSorted.findIndex((player) => player.seatIndex === dealerSeatIndex);
  const safeDealerIndex = dealerIndex >= 0 ? dealerIndex : 0;

  let startIndex = safeDealerIndex;

  if (street === "preflop") {
    const sbIndex = seatSorted.length === 2 ? safeDealerIndex : getNextActiveIndex(seatSorted, safeDealerIndex);
    const bbIndex = getNextActiveIndex(seatSorted, sbIndex);
    startIndex = bbIndex;
  }

  const orderedIds: string[] = [];
  let cursor = startIndex;

  for (let i = 0; i < seatSorted.length; i += 1) {
    cursor = getNextIndex(cursor, seatSorted.length);
    const player = seatSorted[cursor];

    if (player.status !== "folded" && player.status !== "all-in" && player.stack > 0) {
      orderedIds.push(player.id);
    }
  }

  return orderedIds;
}

export function getNextActingPlayerId(
  actionOrder: string[],
  currentPlayerId: string | null
): string | null {
  if (actionOrder.length === 0) {
    return null;
  }

  if (!currentPlayerId) {
    return actionOrder[0];
  }

  const currentIndex = actionOrder.indexOf(currentPlayerId);

  if (currentIndex === -1 || currentIndex === actionOrder.length - 1) {
    return null;
  }

  return actionOrder[currentIndex + 1];
}

export function getPlayerToCall(player: Player, currentBet: number): number {
  return Math.max(0, currentBet - player.currentBet);
}

export function findPlayer(players: Player[], playerId: string | null): Player | undefined {
  if (!playerId) {
    return undefined;
  }

  return players[findSeatIndexByPlayerId(players, playerId)];
}
