import type { Server as SocketServer } from "socket.io";

import { getRoomStatesByCodeForUsers } from "../modules/rooms/room.service.js";

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
  if (!ioRef) {
    return;
  }

  const sockets = await ioRef.in(roomChannel(roomCode)).fetchSockets();
  if (sockets.length === 0) {
    return;
  }

  const userIds = sockets
    .map((socket) => (socket.data.auth as { userId?: string } | undefined)?.userId ?? null)
    .filter((userId): userId is string => !!userId);

  const statesByUserId = await getRoomStatesByCodeForUsers(roomCode, userIds);
  if (!statesByUserId) {
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
