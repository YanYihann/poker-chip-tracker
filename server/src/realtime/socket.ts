import type { Server as HttpServer } from "node:http";

import { parse as parseCookie } from "cookie";
import { Server } from "socket.io";
import { z } from "zod";

import { resolveCorsOrigin } from "../config/cors.js";
import { env } from "../config/env.js";
import {
  applyPlayerActionByRoomCode,
  getRoomStateByCode,
  setPlayerConnectionByRoomCode,
  setPlayerReadyByRoomCode,
  startRoomByHost
} from "../modules/rooms/room.service.js";
import { resolveSession } from "../modules/auth/session.service.js";
import { broadcastRoomState, roomChannel, setRealtimeServer } from "./room-broadcast.js";

const subscribePayloadSchema = z.object({
  roomCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/)
});

const setReadyPayloadSchema = z.object({
  roomCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
  isReady: z.boolean()
});
const actionPayloadSchema = z.object({
  roomCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
  actionType: z.enum(["fold", "check", "call", "bet", "raise", "all-in"])
});

type SocketAuthData = {
  userId: string;
};

export function setupSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: resolveCorsOrigin,
      credentials: true
    }
  });

  setRealtimeServer(io);

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const parsed = parseCookie(cookieHeader ?? "");
      const token = parsed[env.SESSION_COOKIE_NAME];

      const session = await resolveSession(token);

      if (!session) {
        next(new Error("UNAUTHORIZED"));
        return;
      }

      socket.data.auth = {
        userId: session.userId
      } satisfies SocketAuthData;

      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth as SocketAuthData | undefined;
    if (!auth) {
      socket.disconnect(true);
      return;
    }

    const subscribedRoomCodes = new Set<string>();

    socket.emit("socket:ready", { userId: auth.userId });

    socket.on("room:subscribe", async (rawPayload: unknown) => {
      try {
        const payload = subscribePayloadSchema.parse(rawPayload);
        const state = await getRoomStateByCode(payload.roomCode, auth.userId);

        if (!state) {
          socket.emit("room:error", { message: "Room not found." });
          return;
        }

        const isMember = state.players.some((player) => player.userId === auth.userId);
        if (!isMember) {
          socket.emit("room:error", { message: "You are not a room member." });
          return;
        }

        subscribedRoomCodes.add(payload.roomCode);
        socket.join(roomChannel(payload.roomCode));

        await setPlayerConnectionByRoomCode({
          roomCode: payload.roomCode,
          userId: auth.userId,
          isConnected: true
        });

        await broadcastRoomState(payload.roomCode);
      } catch {
        socket.emit("room:error", { message: "Invalid subscribe payload." });
      }
    });

    socket.on("room:unsubscribe", async (rawPayload: unknown) => {
      try {
        const payload = subscribePayloadSchema.parse(rawPayload);
        subscribedRoomCodes.delete(payload.roomCode);
        socket.leave(roomChannel(payload.roomCode));
        await setPlayerConnectionByRoomCode({
          roomCode: payload.roomCode,
          userId: auth.userId,
          isConnected: false
        });
        await broadcastRoomState(payload.roomCode);
      } catch {
        socket.emit("room:error", { message: "Invalid unsubscribe payload." });
      }
    });

    socket.on("room:set-ready", async (rawPayload: unknown) => {
      try {
        const payload = setReadyPayloadSchema.parse(rawPayload);
        await setPlayerReadyByRoomCode({
          roomCode: payload.roomCode,
          userId: auth.userId,
          isReady: payload.isReady
        });
        await broadcastRoomState(payload.roomCode);
      } catch {
        socket.emit("room:error", { message: "Unable to update ready state." });
      }
    });

    socket.on("room:start", async (rawPayload: unknown) => {
      try {
        const payload = subscribePayloadSchema.parse(rawPayload);
        await startRoomByHost({
          roomCode: payload.roomCode,
          hostUserId: auth.userId
        });
        await broadcastRoomState(payload.roomCode);
      } catch {
        socket.emit("room:error", { message: "Unable to start room." });
      }
    });

    socket.on("room:action", async (rawPayload: unknown) => {
      try {
        const payload = actionPayloadSchema.parse(rawPayload);
        await applyPlayerActionByRoomCode({
          roomCode: payload.roomCode,
          userId: auth.userId,
          actionType: payload.actionType
        });
        await broadcastRoomState(payload.roomCode);
      } catch {
        socket.emit("room:error", { message: "Unable to apply action." });
      }
    });

    socket.on("disconnect", async () => {
      await Promise.all(
        Array.from(subscribedRoomCodes).map(async (roomCode) => {
          await setPlayerConnectionByRoomCode({
            roomCode,
            userId: auth.userId,
            isConnected: false
          });
          await broadcastRoomState(roomCode);
        })
      );
    });
  });

  return io;
}
