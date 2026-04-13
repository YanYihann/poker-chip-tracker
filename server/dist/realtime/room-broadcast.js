import { getRoomStateByCode } from "../modules/rooms/room.service.js";
let ioRef = null;
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
    await Promise.all(sockets.map(async (socket) => {
        const auth = socket.data.auth;
        const userId = auth?.userId ?? null;
        const state = await getRoomStateByCode(roomCode, userId);
        if (!state) {
            return;
        }
        socket.emit("room:state", state);
    }));
}
