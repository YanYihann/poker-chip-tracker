/** No-limit Hold'em rules shared by the local controller and authoritative API. */
export type BettingAction = "fold" | "check" | "call" | "bet" | "raise" | "all-in";
export type RoundAction = {
  playerId: string;
  actionType: string;
  amount: number;
};

export function replayBettingRound(actions: RoundAction[], bigBlind: number) {
  const invested: Record<string, number> = {};
  const actedAtBet: Record<string, number> = {};
  let currentBet = 0;
  let minRaiseDelta = bigBlind;
  for (const action of actions) {
    const total = (invested[action.playerId] ?? 0) + action.amount;
    invested[action.playerId] = total;
    const blind = action.actionType === "POST_SB" || action.actionType === "POST_BB";
    if (total > currentBet) {
      const delta = total - currentBet;
      if (!blind && delta >= minRaiseDelta) minRaiseDelta = delta;
      currentBet = total;
    }
    if (!blind) actedAtBet[action.playerId] = currentBet;
  }
  return { currentBet, minRaiseDelta, actedAtBet };
}

export function canRaiseBet(currentBet: number, minRaiseDelta: number, lastActedBet?: number): boolean {
  return lastActedBet === undefined ||
    (lastActedBet === 0 && currentBet > 0) ||
    currentBet - lastActedBet >= minRaiseDelta;
}

export function minimumRaiseTo(currentBet: number, minRaiseDelta: number, bigBlind: number): number {
  return currentBet < bigBlind ? bigBlind : currentBet + minRaiseDelta;
}

export function legalBettingActions(input: {
  stack: number;
  playerBet: number;
  currentBet: number;
  minRaiseDelta: number;
  bigBlind: number;
  lastActedBet?: number;
  canOpponentRespond: boolean;
}): BettingAction[] {
  const { stack, playerBet, currentBet, minRaiseDelta, bigBlind, lastActedBet, canOpponentRespond } = input;
  if (stack <= 0) return [];
  const toCall = Math.max(0, currentBet - playerBet);
  const actions: BettingAction[] = ["fold", toCall > 0 ? "call" : "check"];
  const raiseOpen = canOpponentRespond && canRaiseBet(currentBet, minRaiseDelta, lastActedBet);
  if (raiseOpen && playerBet + stack >= minimumRaiseTo(currentBet, minRaiseDelta, bigBlind)) {
    actions.push(currentBet === 0 ? "bet" : "raise");
  }
  if (stack <= toCall || raiseOpen) actions.push("all-in");
  return actions;
}

export function buildContributionPots(contributions: Array<{ playerId: string; amount: number }>) {
  const levels = [...new Set(contributions.map((p) => p.amount).filter((n) => n > 0))].sort((a, b) => a - b);
  let previous = 0;
  return levels.map((level) => {
    const participants = contributions.filter((p) => p.amount >= level).map((p) => p.playerId);
    const amount = (level - previous) * participants.length;
    const contribution = level - previous;
    previous = level;
    return { amount, contribution, participants };
  });
}

export function splitPotClockwise(
  amount: number,
  winners: Array<{ playerId: string; seatIndex: number }>,
  dealerSeat: number
): Record<string, number> {
  if (winners.length === 0) throw new Error("WINNERS_REQUIRED");
  const clockwise = [...winners].sort((a, b) => {
    const aAfter = a.seatIndex > dealerSeat;
    const bAfter = b.seatIndex > dealerSeat;
    return aAfter === bAfter ? a.seatIndex - b.seatIndex : aAfter ? -1 : 1;
  });
  const base = Math.floor(amount / clockwise.length);
  const remainder = amount % clockwise.length;
  return Object.fromEntries(clockwise.map((p, i) => [p.playerId, base + (i < remainder ? 1 : 0)]));
}
