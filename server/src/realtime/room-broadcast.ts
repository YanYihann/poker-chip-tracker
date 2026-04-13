import type { Server as SocketServer } from "socket.io";

import { getRoomStateByCode } from "../modules/rooms/room.service.js";

let ioRef: SocketServer | null = null;

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

  await Promise.all(
    sockets.map(async (socket) => {
      const auth = socket.data.auth as { userId?: string } | undefined;
      const userId = auth?.userId ?? null;
      const state = await getRoomStateByCode(roomCode, userId);

      if (!state) {
        return;
      }

      socket.emit("room:state", state);
    })
  );
}
