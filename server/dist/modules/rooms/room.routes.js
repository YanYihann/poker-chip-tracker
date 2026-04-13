import { Router } from "express";
import { ZodError } from "zod";
import { requireAuth } from "../auth/session.middleware.js";
import { roomActionSchema, createRoomSchema, joinRoomSchema, roomCodeParamSchema, setReadySchema } from "./room.schemas.js";
import { applyPlayerActionByRoomCode, createRoom, getRoomStateByCode, joinRoomByCode, setPlayerReadyByRoomCode, startRoomByHost } from "./room.service.js";
import { broadcastRoomState } from "../../realtime/room-broadcast.js";
function sendValidationError(error, res) {
    res.status(400).json({
        message: "Invalid request.",
        issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
        }))
    });
}
function sendRoomError(error, res) {
    if (!(error instanceof Error)) {
        res.status(500).json({ message: "Unexpected room error." });
        return;
    }
    switch (error.message) {
        case "ROOM_NOT_FOUND":
            res.status(404).json({ message: "Room not found." });
            return;
        case "ROOM_NOT_JOINABLE":
            res.status(409).json({ message: "Room is not joinable." });
            return;
        case "ROOM_FULL":
            res.status(409).json({ message: "Room is full." });
            return;
        case "NOT_A_MEMBER":
            res.status(403).json({ message: "You are not a room member." });
            return;
        case "HOST_ONLY":
            res.status(403).json({ message: "Only host can start game." });
            return;
        case "ROOM_NOT_WAITING":
            res.status(409).json({ message: "Room is not in waiting state." });
            return;
        case "ROOM_ALREADY_STARTED":
            res.status(409).json({ message: "Room already started." });
            return;
        case "ROOM_NOT_READY":
            res.status(409).json({ message: "All players must be ready before start." });
            return;
        case "ROOM_NOT_ACTIVE":
            res.status(409).json({ message: "Room game is not active." });
            return;
        case "HAND_LOCKED":
            res.status(409).json({ message: "Hand is locked." });
            return;
        case "NOT_YOUR_TURN":
            res.status(403).json({ message: "Not your turn." });
            return;
        case "ILLEGAL_ACTION":
            res.status(409).json({ message: "Illegal action for current state." });
            return;
        default:
            res.status(500).json({ message: "Room operation failed." });
    }
}
export function createRoomRouter() {
    const router = Router();
    router.use(requireAuth);
    router.post("/", async (req, res) => {
        try {
            const payload = createRoomSchema.parse(req.body);
            const roomState = await createRoom({
                hostUserId: req.authSession.userId,
                ...payload
            });
            await broadcastRoomState(roomState.room.code);
            res.status(201).json({ room: roomState });
        }
        catch (error) {
            if (error instanceof ZodError) {
                sendValidationError(error, res);
                return;
            }
            sendRoomError(error, res);
        }
    });
    router.post("/join", async (req, res) => {
        try {
            const payload = joinRoomSchema.parse(req.body);
            const roomState = await joinRoomByCode({
                userId: req.authSession.userId,
                roomCode: payload.roomCode,
                displayName: payload.displayName
            });
            await broadcastRoomState(roomState.room.code);
            res.status(200).json({ room: roomState });
        }
        catch (error) {
            if (error instanceof ZodError) {
                sendValidationError(error, res);
                return;
            }
            sendRoomError(error, res);
        }
    });
    router.get("/:roomCode", async (req, res) => {
        try {
            const { roomCode } = roomCodeParamSchema.parse(req.params);
            const roomState = await getRoomStateByCode(roomCode, req.authSession.userId);
            if (!roomState) {
                res.status(404).json({ message: "Room not found." });
                return;
            }
            const isMember = roomState.players.some((player) => player.userId === req.authSession.userId);
            if (!isMember) {
                res.status(403).json({ message: "You are not a room member." });
                return;
            }
            res.status(200).json({ room: roomState });
        }
        catch (error) {
            if (error instanceof ZodError) {
                sendValidationError(error, res);
                return;
            }
            sendRoomError(error, res);
        }
    });
    router.patch("/:roomCode/ready", async (req, res) => {
        try {
            const { roomCode } = roomCodeParamSchema.parse(req.params);
            const payload = setReadySchema.parse(req.body);
            const roomState = await setPlayerReadyByRoomCode({
                roomCode,
                userId: req.authSession.userId,
                isReady: payload.isReady
            });
            await broadcastRoomState(roomCode);
            res.status(200).json({ room: roomState });
        }
        catch (error) {
            if (error instanceof ZodError) {
                sendValidationError(error, res);
                return;
            }
            sendRoomError(error, res);
        }
    });
    router.post("/:roomCode/start", async (req, res) => {
        try {
            const { roomCode } = roomCodeParamSchema.parse(req.params);
            const roomState = await startRoomByHost({
                roomCode,
                hostUserId: req.authSession.userId
            });
            await broadcastRoomState(roomCode);
            res.status(200).json({ room: roomState });
        }
        catch (error) {
            if (error instanceof ZodError) {
                sendValidationError(error, res);
                return;
            }
            sendRoomError(error, res);
        }
    });
    router.post("/:roomCode/action", async (req, res) => {
        try {
            const { roomCode } = roomCodeParamSchema.parse(req.params);
            const payload = roomActionSchema.parse(req.body);
            const roomState = await applyPlayerActionByRoomCode({
                roomCode,
                userId: req.authSession.userId,
                actionType: payload.actionType
            });
            await broadcastRoomState(roomCode);
            res.status(200).json({ room: roomState });
        }
        catch (error) {
            if (error instanceof ZodError) {
                sendValidationError(error, res);
                return;
            }
            sendRoomError(error, res);
        }
    });
    return router;
}
