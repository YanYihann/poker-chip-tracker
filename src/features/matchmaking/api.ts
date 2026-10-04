import { getApiUrl, toNetworkError } from "@/lib/api-base-url";

export type MatchState =
  | { status: "idle" }
  | { status: "waiting"; ticketId: string; joinedAt: string }
  | { status: "matched"; ticketId: string; roomCode: string };
export type MatchResponse = {
  match: MatchState;
  settings: { maxPlayers: number; startingStack: number; smallBlind: number; bigBlind: number };
};

async function request(operation?: "join" | "heartbeat" | "cancel", ticketId?: string, keepalive = false): Promise<MatchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(getApiUrl(`/api/matchmaking${operation ? `/${operation}` : ""}`), {
      method: operation ? "POST" : "GET", credentials: "include", cache: "no-store", keepalive,
      headers: { "Content-Type": "application/json" },
      body: operation ? JSON.stringify(ticketId ? { ticketId } : {}) : undefined,
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Matching is unavailable. Please try again.");
    return payload as MatchResponse;
  } catch (error) { throw toNetworkError(error); }
  finally { clearTimeout(timeout); }
}

export const getMatchState = () => request();
export const joinMatchQueue = () => request("join");
export const heartbeatMatch = (ticketId: string) => request("heartbeat", ticketId);
export const cancelMatch = (ticketId: string, keepalive = false) => request("cancel", ticketId, keepalive);
