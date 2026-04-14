import type { CardCode } from "./deck.js";

type EvaluatedFiveCardHand = {
  category: number;
  tiebreakers: number[];
  cards: CardCode[];
};

export type HoldemHandStrength = {
  category: number;
  tiebreakers: number[];
  bestFiveCards: CardCode[];
};

const RANK_VALUE_BY_CODE: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

function getRankValue(card: CardCode): number {
  return RANK_VALUE_BY_CODE[card[0] as keyof typeof RANK_VALUE_BY_CODE];
}

function getSuitCode(card: CardCode): string {
  return card[1];
}

function compareLexicographic(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
}

function compareFiveCardHands(left: EvaluatedFiveCardHand, right: EvaluatedFiveCardHand): number {
  if (left.category !== right.category) {
    return left.category > right.category ? 1 : -1;
  }

  return compareLexicographic(left.tiebreakers, right.tiebreakers);
}

function detectStraightHigh(rankValues: number[]): number | null {
  const uniqueDescending = Array.from(new Set(rankValues)).sort((a, b) => b - a);
  if (uniqueDescending.length < 5) {
    return null;
  }

  for (let index = 0; index <= uniqueDescending.length - 5; index += 1) {
    const window = uniqueDescending.slice(index, index + 5);
    if (window[0] - window[4] === 4) {
      return window[0];
    }
  }

  const hasWheel = [14, 5, 4, 3, 2].every((value) => uniqueDescending.includes(value));
  return hasWheel ? 5 : null;
}

function evaluateFiveCardHand(cards: CardCode[]): EvaluatedFiveCardHand {
  const ranksDescending = cards.map(getRankValue).sort((a, b) => b - a);
  const suits = cards.map(getSuitCode);
  const isFlush = suits.every((suit) => suit === suits[0]);
  const straightHigh = detectStraightHigh(ranksDescending);

  const countByRank = new Map<number, number>();
  for (const rank of ranksDescending) {
    countByRank.set(rank, (countByRank.get(rank) ?? 0) + 1);
  }

  const rankGroups = Array.from(countByRank.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return right.rank - left.rank;
    });

  if (isFlush && straightHigh !== null) {
    return {
      category: 8,
      tiebreakers: [straightHigh],
      cards
    };
  }

  if (rankGroups[0]?.count === 4) {
    const kicker = rankGroups.find((group) => group.count === 1)?.rank ?? 0;
    return {
      category: 7,
      tiebreakers: [rankGroups[0].rank, kicker],
      cards
    };
  }

  if (rankGroups[0]?.count === 3 && rankGroups[1]?.count === 2) {
    return {
      category: 6,
      tiebreakers: [rankGroups[0].rank, rankGroups[1].rank],
      cards
    };
  }

  if (isFlush) {
    return {
      category: 5,
      tiebreakers: ranksDescending,
      cards
    };
  }

  if (straightHigh !== null) {
    return {
      category: 4,
      tiebreakers: [straightHigh],
      cards
    };
  }

  if (rankGroups[0]?.count === 3) {
    const kickers = rankGroups
      .filter((group) => group.count === 1)
      .map((group) => group.rank)
      .sort((a, b) => b - a);
    return {
      category: 3,
      tiebreakers: [rankGroups[0].rank, ...kickers],
      cards
    };
  }

  if (rankGroups[0]?.count === 2 && rankGroups[1]?.count === 2) {
    const topPair = Math.max(rankGroups[0].rank, rankGroups[1].rank);
    const secondPair = Math.min(rankGroups[0].rank, rankGroups[1].rank);
    const kicker = rankGroups.find((group) => group.count === 1)?.rank ?? 0;
    return {
      category: 2,
      tiebreakers: [topPair, secondPair, kicker],
      cards
    };
  }

  if (rankGroups[0]?.count === 2) {
    const kickers = rankGroups
      .filter((group) => group.count === 1)
      .map((group) => group.rank)
      .sort((a, b) => b - a);
    return {
      category: 1,
      tiebreakers: [rankGroups[0].rank, ...kickers],
      cards
    };
  }

  return {
    category: 0,
    tiebreakers: ranksDescending,
    cards
  };
}

function* selectFiveCardCombos(cards: readonly CardCode[]): Generator<CardCode[]> {
  const total = cards.length;
  for (let a = 0; a < total - 4; a += 1) {
    for (let b = a + 1; b < total - 3; b += 1) {
      for (let c = b + 1; c < total - 2; c += 1) {
        for (let d = c + 1; d < total - 1; d += 1) {
          for (let e = d + 1; e < total; e += 1) {
            yield [cards[a], cards[b], cards[c], cards[d], cards[e]];
          }
        }
      }
    }
  }
}

export function evaluateBestHoldemHand(cards: readonly CardCode[]): HoldemHandStrength {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error("INVALID_EVALUATOR_CARD_COUNT");
  }

  let best: EvaluatedFiveCardHand | null = null;
  for (const combo of selectFiveCardCombos(cards)) {
    const evaluated = evaluateFiveCardHand(combo);
    if (!best || compareFiveCardHands(evaluated, best) > 0) {
      best = evaluated;
    }
  }

  if (!best) {
    throw new Error("INVALID_EVALUATOR_COMBO");
  }

  return {
    category: best.category,
    tiebreakers: best.tiebreakers,
    bestFiveCards: best.cards
  };
}

export function compareHoldemHandStrength(
  left: HoldemHandStrength,
  right: HoldemHandStrength
): number {
  if (left.category !== right.category) {
    return left.category > right.category ? 1 : -1;
  }

  return compareLexicographic(left.tiebreakers, right.tiebreakers);
}
