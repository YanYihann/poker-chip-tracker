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
    if (!ioRef) {
        return;
    }
    const sockets = await ioRef.in(roomChannel(roomCode)).fetchSockets();
    if (sockets.length === 0) {
        return;
    }
    const userIds = sockets
        .map((socket) => socket.data.auth?.userId ?? null)
        .filter((userId) => !!userId);
    const statesByUserId = await getRoomStatesByCodeForUsers(roomCode, userIds);
    if (!statesByUserId) {
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
