import { randomInt } from "node:crypto";

export const CARD_RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A"
] as const;

export const CARD_SUITS = ["S", "H", "D", "C"] as const;

export type CardRank = (typeof CARD_RANKS)[number];
export type CardSuit = (typeof CARD_SUITS)[number];
export type CardCode = `${CardRank}${CardSuit}`;
export type StreetCode = "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";

const CARD_CODE_PATTERN = /^[2-9TJQKA][SHDC]$/;

export function isCardCode(value: string): value is CardCode {
  return CARD_CODE_PATTERN.test(value);
}

export function createStandardDeck(): CardCode[] {
  const deck: CardCode[] = [];

  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }

  return deck;
}

export function shuffleDeck(deck: readonly CardCode[]): CardCode[] {
  const copy = [...deck];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const swapIndex = randomInt(i + 1);
    const current = copy[i];
    copy[i] = copy[swapIndex];
    copy[swapIndex] = current;
  }

  return copy;
}

export function dealCards(input: {
  shuffledDeck: readonly CardCode[];
  dealingOrderUserIds: readonly string[];
  holeCardsPerPlayer?: number;
  boardCardCount?: number;
}): {
  holeCardsByUser: Record<string, CardCode[]>;
  boardCards: CardCode[];
  remainingDeck: CardCode[];
} {
  const holeCardsPerPlayer = input.holeCardsPerPlayer ?? 2;
  const boardCardCount = input.boardCardCount ?? 5;
  const deck = [...input.shuffledDeck];
  const holeCardsByUser: Record<string, CardCode[]> = {};
  let cursor = 0;

  if (input.dealingOrderUserIds.length < 2) {
    throw new Error("NOT_ENOUGH_ACTIVE_PLAYERS");
  }

  for (let round = 0; round < holeCardsPerPlayer; round += 1) {
    for (const userId of input.dealingOrderUserIds) {
      const card = deck[cursor];
      if (!card) {
        throw new Error("DECK_EXHAUSTED");
      }

      if (!holeCardsByUser[userId]) {
        holeCardsByUser[userId] = [];
      }
      holeCardsByUser[userId].push(card);
      cursor += 1;
    }
  }

  const boardCards = deck.slice(cursor, cursor + boardCardCount);
  if (boardCards.length < boardCardCount) {
    throw new Error("DECK_EXHAUSTED");
  }
  cursor += boardCardCount;

  return {
    holeCardsByUser,
    boardCards,
    remainingDeck: deck.slice(cursor)
  };
}

export function revealedBoardCardsByStreet(
  boardCards: readonly CardCode[],
  street: StreetCode
): CardCode[] {
  if (street === "PREFLOP") {
    return [];
  }
  if (street === "FLOP") {
    return [...boardCards.slice(0, 3)];
  }
  if (street === "TURN") {
    return [...boardCards.slice(0, 4)];
  }
  return [...boardCards.slice(0, 5)];
}

