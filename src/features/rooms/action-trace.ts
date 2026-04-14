import type { RoomActionTraceMeta } from "@/features/rooms/api";

type PendingClientTrace = {
  traceId: string;
  roomCode: string;
  actionType: string;
  clickedAtMs: number;
  clickedPerfMs: number;
};

const pendingTraceById = new Map<string, PendingClientTrace>();
const TRACE_TTL_MS = 60_000;

function makeTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanupExpiredTraces(nowMs: number): void {
  pendingTraceById.forEach((trace, traceId) => {
    if (nowMs - trace.clickedAtMs > TRACE_TTL_MS) {
      pendingTraceById.delete(traceId);
    }
  });
}

export function startClientActionTrace(input: {
  roomCode: string;
  actionType: string;
}): {
  traceId: string;
  clientActionAtMs: number;
} {
  const clientActionAtMs = Date.now();
  const traceId = makeTraceId();
  const clickedPerfMs = typeof performance !== "undefined" ? performance.now() : clientActionAtMs;

  cleanupExpiredTraces(clientActionAtMs);
  pendingTraceById.set(traceId, {
    traceId,
    roomCode: input.roomCode.toUpperCase(),
    actionType: input.actionType,
    clickedAtMs: clientActionAtMs,
    clickedPerfMs
  });

  console.info("[online-trace] client_action_click", {
    traceId,
    roomCode: input.roomCode.toUpperCase(),
    actionType: input.actionType,
    clientActionAtMs
  });

  return {
    traceId,
    clientActionAtMs
  };
}

export function isClientActionTracePending(traceId: string): boolean {
  return pendingTraceById.has(traceId);
}

export function clearClientActionTrace(traceId: string): void {
  pendingTraceById.delete(traceId);
}

export function logClientPatchReceived(patchMeta: RoomActionTraceMeta | undefined, roomCode: string): void {
  const clientUpdateReceivedAtMs = Date.now();
  const clientUpdateReceivedPerfMs =
    typeof performance !== "undefined" ? performance.now() : clientUpdateReceivedAtMs;
  const trace = patchMeta?.traceId ? pendingTraceById.get(patchMeta.traceId) : null;
  const clientTransportMs =
    trace && clientUpdateReceivedPerfMs >= trace.clickedPerfMs
      ? Number((clientUpdateReceivedPerfMs - trace.clickedPerfMs).toFixed(2))
      : null;

  console.info("[online-trace] client_update_received", {
    traceId: patchMeta?.traceId ?? null,
    roomCode: roomCode.toUpperCase(),
    clientUpdateReceivedAtMs,
    clientTransportMs,
    requestToBroadcastMs:
      patchMeta && patchMeta.websocketBroadcastSentAtMs
        ? patchMeta.websocketBroadcastSentAtMs - patchMeta.requestReceivedAtMs
        : null
  });

  if (trace?.traceId) {
    pendingTraceById.delete(trace.traceId);
  }
}
