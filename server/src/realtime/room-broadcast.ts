import { performance } from "node:perf_hooks";
import type { Server as SocketServer } from "socket.io";

import { recordPerfSample } from "../lib/perf-metrics.js";
import { getRoomStatesByCodeForUsers } from "../modules/rooms/room.service.js";
import type { RoomActionPatch } from "./room-patch.js";

let ioRef: SocketServer | null = null;
const BROADCAST_COALESCE_MS = 20;
const pendingBroadcastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function roomChannel(roomCode: string): string {
  return `room:${roomCode.toUpperCase()}`;
}

export function setRealtimeServer(io: SocketServer): void {
  ioRef = io;
}

export async function broadcastRoomState(roomCode: string): Promise<void> {
  const startedAt = performance.now();
  let socketCount = 0;
  const normalizedRoomCode = roomCode.toUpperCase();

  if (!ioRef) {
    recordPerfSample("realtime.broadcastRoomState", performance.now() - startedAt, {
      roomCode: normalizedRoomCode,
      socketCount,
      skipped: "no-realtime-server"
    });
    return;
  }

  const sockets = await ioRef.in(roomChannel(normalizedRoomCode)).fetchSockets();
  socketCount = sockets.length;
  if (sockets.length === 0) {
    recordPerfSample("realtime.broadcastRoomState", performance.now() - startedAt, {
      roomCode: normalizedRoomCode,
      socketCount
    });
    return;
  }

  const userIds = sockets
    .map((socket) => (socket.data.auth as { userId?: string } | undefined)?.userId ?? null)
    .filter((userId): userId is string => !!userId);

  const statesByUserId = await getRoomStatesByCodeForUsers(normalizedRoomCode, userIds);
  if (!statesByUserId) {
    recordPerfSample("realtime.broadcastRoomState", performance.now() - startedAt, {
      roomCode: normalizedRoomCode,
      socketCount,
      skipped: "room-not-found"
    });
    return;
  }

  await Promise.all(
    sockets.map(async (socket) => {
      const auth = socket.data.auth as { userId?: string } | undefined;
      const userId = auth?.userId;
      if (!userId) {
        return;
      }

      const state = statesByUserId.get(userId);
      if (!state) {
        return;
      }
      socket.emit("room:state", state);
    })
  );

  recordPerfSample("realtime.broadcastRoomState", performance.now() - startedAt, {
    roomCode: normalizedRoomCode,
    socketCount
  });
}

export function scheduleBroadcastRoomState(roomCode: string): void {
  const normalizedRoomCode = roomCode.toUpperCase();

  if (pendingBroadcastTimers.has(normalizedRoomCode)) {
    return;
  }

  const timer = setTimeout(() => {
    pendingBroadcastTimers.delete(normalizedRoomCode);
    void broadcastRoomState(normalizedRoomCode).catch((error) => {
      console.error("[realtime] room broadcast failed", { roomCode: normalizedRoomCode, error });
    });
  }, BROADCAST_COALESCE_MS);

  pendingBroadcastTimers.set(normalizedRoomCode, timer);
}

export function emitRoomActionPatch(roomCode: string, patch: RoomActionPatch): void {
  if (!ioRef) {
    return;
  }

  ioRef.to(roomChannel(roomCode)).emit("room:patch", patch);
}
