import { performance } from "node:perf_hooks";
import { recordPerfSample } from "../lib/perf-metrics.js";
import { getRoomStatesByCodeForUsers } from "../modules/rooms/room.service.js";
let ioRef = null;
const BROADCAST_COALESCE_MS = 20;
const pendingBroadcastTimers = new Map();
export function roomChannel(roomCode) {
    return `room:${roomCode.toUpperCase()}`;
}
export function setRealtimeServer(io) {
    ioRef = io;
}
export async function broadcastRoomState(roomCode) {
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
        .map((socket) => socket.data.auth?.userId ?? null)
        .filter((userId) => !!userId);
    const statesByUserId = await getRoomStatesByCodeForUsers(normalizedRoomCode, userIds);
    if (!statesByUserId) {
        recordPerfSample("realtime.broadcastRoomState", performance.now() - startedAt, {
            roomCode: normalizedRoomCode,
            socketCount,
            skipped: "room-not-found"
        });
        return;
    }
    await Promise.all(sockets.map(async (socket) => {
        const auth = socket.data.auth;
        const userId = auth?.userId;
        if (!userId) {
            return;
        }
        const state = statesByUserId.get(userId);
        if (!state) {
            return;
        }
        socket.emit("room:state", state);
    }));
    recordPerfSample("realtime.broadcastRoomState", performance.now() - startedAt, {
        roomCode: normalizedRoomCode,
        socketCount
    });
}
export function scheduleBroadcastRoomState(roomCode) {
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
