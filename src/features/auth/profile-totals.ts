import type { ProfilePayload } from "./api";
import type { SessionSummary } from "../settlement/session-summary";

// Anonymous table records have no account identity; never infer one from a name.
export function includeDeviceSessions(profile: ProfilePayload, userId: string, summaries: readonly SessionSummary[]): ProfilePayload {
  const local = { ...profile.byMode.local };
  const seen = new Set<string>();
  for (const summary of summaries) {
    if (seen.has(summary.id) || summary.owner?.userId !== userId ||
      (profile.historyResetAtIso && summary.endedAtIso <= profile.historyResetAtIso)) continue;
    seen.add(summary.id);
    const player = summary.players.find((entry) => entry.id === summary.owner?.playerId);
    if (!player || !Number.isSafeInteger(player.netChange)) continue;
    local.sessions++;
    local.hands += summary.hands.filter((hand) => hand.results.some((result) => result.playerId === player.id && result.startStack > 0)).length;
    local.profit = (BigInt(local.profit) + BigInt(Math.max(0, player.netChange))).toString();
    local.loss = (BigInt(local.loss) + BigInt(Math.max(0, -player.netChange))).toString();
    local.net = (BigInt(local.profit) - BigInt(local.loss)).toString();
  }
  const online = profile.byMode.online;
  return { ...profile, byMode: { online, local }, totals: {
    sessions: online.sessions + local.sessions, hands: online.hands + local.hands,
    profit: (BigInt(online.profit) + BigInt(local.profit)).toString(),
    loss: (BigInt(online.loss) + BigInt(local.loss)).toString(),
    net: (BigInt(online.net) + BigInt(local.net)).toString()
  } };
}
