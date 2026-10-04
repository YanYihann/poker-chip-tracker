import type { SessionDetail } from "@/features/auth/api";

export type SessionHandResult = { playerId: string; name: string; amountWon: number; netChange: number; startStack: number; endStack: number };
export type SessionHandRecord = { handNumber: number; potTotal: number; results: SessionHandResult[] };
export type SessionSummary = {
  id: string;
  name: string;
  startedAtIso: string;
  endedAtIso: string;
  historyComplete: boolean;
  players: Array<{ id: string; name: string; startStack: number; endStack: number; netChange: number; handsWon: number }>;
  hands: SessionHandRecord[];
};
export type LocalSessionLedger = {
  historyComplete: boolean;
  startingPlayers: Array<{ id: string; name: string; stack: number }>;
  hands: SessionHandRecord[];
  handStartStacks: Record<string, number>;
  handPayouts: Record<string, number>;
  endedAtIso?: string;
};

export function createLocalLedger(players: readonly { id: string; name: string; stack: number }[], historyComplete = true): LocalSessionLedger {
  return { historyComplete, startingPlayers: players.map(({ id, name, stack }) => ({ id, name, stack })), hands: [], handStartStacks: {}, handPayouts: {} };
}

export function recordLocalPayout(ledger: LocalSessionLedger, players: readonly { id: string; name: string; stack: number }[], payouts: Record<string, number>, complete: boolean): LocalSessionLedger {
  const handPayouts = { ...ledger.handPayouts };
  for (const [id, amount] of Object.entries(payouts)) handPayouts[id] = (handPayouts[id] ?? 0) + amount;
  if (!complete) return { ...ledger, handPayouts };
  const results = players.map((player) => ({
    playerId: player.id, name: player.name, amountWon: handPayouts[player.id] ?? 0,
    startStack: ledger.handStartStacks[player.id] ?? player.stack, endStack: player.stack,
    netChange: player.stack - (ledger.handStartStacks[player.id] ?? player.stack)
  }));
  return { ...ledger, handPayouts,
    hands: [...ledger.hands, { handNumber: ledger.hands.length + 1, potTotal: results.reduce((sum, result) => sum + result.amountWon, 0), results }]
  };
}

export function summarizeLocalSession(input: { sessionId: string; sessionName: string; startedAtIso: string; players: readonly { id: string; name: string; stack: number }[]; ledger: LocalSessionLedger }): SessionSummary {
  return {
    id: input.sessionId, name: input.sessionName, startedAtIso: input.startedAtIso,
    endedAtIso: input.ledger.endedAtIso ?? new Date().toISOString(), historyComplete: input.ledger.historyComplete,
    hands: input.ledger.hands,
    players: input.ledger.startingPlayers.map((start) => {
      const player = input.players.find((p) => p.id === start.id);
      const endStack = player?.stack ?? start.stack;
      return { id: start.id, name: player?.name ?? start.name, startStack: start.stack, endStack, netChange: endStack - start.stack,
        handsWon: input.ledger.hands.filter((hand) => hand.results.some((r) => r.playerId === start.id && r.amountWon > 0)).length };
    })
  };
}

export function summarizeOnlineSession(detail: SessionDetail): SessionSummary {
  const balances = new Map(detail.players.map((player) => [player.userId, Number(player.startStack)]));
  const hands = [...detail.hands].sort((a, b) => a.handNumber - b.handNumber).map((hand) => ({
    handNumber: hand.handNumber, potTotal: Number(hand.potTotal),
    results: detail.players.map((player) => {
      const result = hand.results.find((entry) => entry.userId === player.userId);
      const startStack = balances.get(player.userId) ?? 0;
      const netChange = Number(result?.netChange ?? 0);
      const endStack = startStack + netChange;
      balances.set(player.userId, endStack);
      return { playerId: player.userId, name: player.username, startStack, endStack, netChange, amountWon: Number(result?.amountWon ?? 0) };
    })
  }));
  return {
    id: detail.session.id, name: `Room ${detail.session.roomCode}`, startedAtIso: detail.session.startedAtIso,
    endedAtIso: detail.session.endedAtIso, historyComplete: true, hands,
    players: detail.players.map((player) => ({ id: player.userId, name: player.username,
      startStack: Number(player.startStack), endStack: Number(player.endStack), netChange: Number(player.profitLoss),
      handsWon: hands.filter((hand) => hand.results.some((r) => r.playerId === player.userId && r.amountWon > 0)).length
    }))
  };
}

export function buildChipTransfers(players: readonly { id: string; netChange: number }[]): Array<{ fromPlayerId: string; toPlayerId: string; amount: number }> {
  if (players.some((player) => !Number.isSafeInteger(player.netChange)) || players.reduce((sum, player) => sum + player.netChange, 0) !== 0) return [];
  const order = (a: { id: string; remaining: number }, b: { id: string; remaining: number }) => b.remaining - a.remaining || a.id.localeCompare(b.id);
  const debtors = players.filter((p) => p.netChange < 0).map((p) => ({ id: p.id, remaining: -p.netChange })).sort(order);
  const creditors = players.filter((p) => p.netChange > 0).map((p) => ({ id: p.id, remaining: p.netChange })).sort(order);
  const transfers: Array<{ fromPlayerId: string; toPlayerId: string; amount: number }> = [];
  let from = 0, to = 0;
  while (from < debtors.length && to < creditors.length) {
    const amount = Math.min(debtors[from].remaining, creditors[to].remaining);
    transfers.push({ fromPlayerId: debtors[from].id, toPlayerId: creditors[to].id, amount });
    debtors[from].remaining -= amount; creditors[to].remaining -= amount;
    if (!debtors[from].remaining) from++;
    if (!creditors[to].remaining) to++;
  }
  return transfers;
}
