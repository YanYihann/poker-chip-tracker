import type { Request, Response } from "express";
import { Router } from "express";
import { ZodError } from "zod";

import { requireAuth } from "../auth/session.middleware.js";
import {
  nextHandDecisionSchema,
  roomActionSchema,
  createRoomSchema,
  joinRoomSchema,
  roomCodeParamSchema,
  setBuyInSchema,
  settleHandSchema,
  updateBlindsSchema,
  setReadySchema
} from "./room.schemas.js";
import {
  applyPlayerActionByRoomCode,
  decideNextHandByRoomCode,
  createRoom,
  getRoomStateByCode,
  joinRoomByCode,
  settleHandByRoomCode,
  setPlayerBuyInByRoomCode,
  setPlayerReadyByRoomCode,
  startRoomByHost,
  updateRoomBlindsByCode
} from "./room.service.js";
import { emitRoomActionPatch, scheduleBroadcastRoomState } from "../../realtime/room-broadcast.js";
import { buildRoomActionPatch } from "../../realtime/room-patch.js";

function sendValidationError(error: ZodError, res: Response): void {
  res.status(400).json({
    message: "Invalid request.",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  });
}

function sendRoomError(error: unknown, res: Response): void {
  if (!(error instanceof Error)) {
    console.error("[rooms] unexpected non-error thrown", error);
    res.status(500).json({ message: "Unexpected room error." });
    return;
  }

  const message = error.message ?? "";
  const looksLikeDbSchemaMismatch =
    message.includes("P2021") ||
    message.includes("P2022") ||
    message.includes("type \"public.GameMode\" does not exist") ||
    message.includes("column") && message.includes("does not exist");

  if (looksLikeDbSchemaMismatch) {
    console.error("[rooms] database schema mismatch", error);
    res.status(503).json({
      message: "Database schema is not ready. Please run backend migrations and redeploy."
    });
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
    case "INVALID_BLINDS":
      res.status(400).json({ message: "Invalid blind settings." });
      return;
    case "HAND_LOCKED":
      res.status(409).json({ message: "Hand is locked." });
      return;
    case "HAND_NOT_FOUND":
      res.status(404).json({ message: "Hand not found." });
      return;
    case "HAND_NOT_SHOWDOWN":
      res.status(409).json({ message: "Hand is not ready for settlement." });
      return;
    case "HAND_ALREADY_SETTLED":
      res.status(409).json({ message: "Hand already settled." });
      return;
    case "HAND_NOT_SETTLED":
      res.status(409).json({ message: "Current hand is not settled yet." });
      return;
    case "NOT_ENOUGH_ACTIVE_PLAYERS":
      res.status(409).json({ message: "Not enough active players to continue." });
      return;
    case "WINNERS_REQUIRED":
      res.status(400).json({ message: "At least one winner is required." });
      return;
    case "INVALID_WINNERS":
      res.status(409).json({ message: "Winner selection is invalid." });
      return;
    case "NOT_YOUR_TURN":
      res.status(403).json({ message: "Not your turn." });
      return;
    case "ILLEGAL_ACTION":
      res.status(409).json({ message: "Illegal action for current state." });
      return;
    default:
      console.error("[rooms] unhandled room error", error);
      res.status(500).json({ message: "Room operation failed." });
  }
}

export function createRoomRouter() {
  const router = Router();
  router.use(requireAuth);

  router.post("/", async (req: Request, res: Response) => {
    try {
      const payload = createRoomSchema.parse(req.body);
      const roomState = await createRoom({
        hostUserId: req.authSession!.userId,
        ...payload
      });

      res.status(201).json({ room: roomState });
      scheduleBroadcastRoomState(roomState.room.code);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  router.post("/join", async (req: Request, res: Response) => {
    try {
      const payload = joinRoomSchema.parse(req.body);
      const roomState = await joinRoomByCode({
        userId: req.authSession!.userId,
        roomCode: payload.roomCode,
        displayName: payload.displayName
      });

      res.status(200).json({ room: roomState });
      scheduleBroadcastRoomState(roomState.room.code);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  router.get("/:roomCode", async (req: Request, res: Response) => {
    try {
      const { roomCode } = roomCodeParamSchema.parse(req.params);
      const roomState = await getRoomStateByCode(roomCode, req.authSession!.userId);

      if (!roomState) {
        res.status(404).json({ message: "Room not found." });
        return;
      }

      const isMember = roomState.players.some((player) => player.userId === req.authSession!.userId);

      if (!isMember) {
        res.status(403).json({ message: "You are not a room member." });
        return;
      }

      res.status(200).json({ room: roomState });
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  router.patch("/:roomCode/ready", async (req: Request, res: Response) => {
    try {
      const { roomCode } = roomCodeParamSchema.parse(req.params);
      const payload = setReadySchema.parse(req.body);
      const roomState = await setPlayerReadyByRoomCode({
        roomCode,
        userId: req.authSession!.userId,
        isReady: payload.isReady
      });

      res.status(200).json({ room: roomState });
      scheduleBroadcastRoomState(roomCode);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  router.patch("/:roomCode/buy-in", async (req: Request, res: Response) => {
    try {
      const { roomCode } = roomCodeParamSchema.parse(req.params);
      const payload = setBuyInSchema.parse(req.body);
      const roomState = await setPlayerBuyInByRoomCode({
        roomCode,
        userId: req.authSession!.userId,
        buyIn: payload.buyIn
      });

      res.status(200).json({ room: roomState });
      scheduleBroadcastRoomState(roomCode);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  router.post("/:roomCode/start", async (req: Request, res: Response) => {
    try {
      const { roomCode } = roomCodeParamSchema.parse(req.params);
      const roomState = await startRoomByHost({
        roomCode,
        hostUserId: req.authSession!.userId
      });

      res.status(200).json({ room: roomState });
      scheduleBroadcastRoomState(roomCode);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  router.patch("/:roomCode/blinds", async (req: Request, res: Response) => {
    try {
      const { roomCode } = roomCodeParamSchema.parse(req.params);
      const payload = updateBlindsSchema.parse(req.body);
      const roomState = await updateRoomBlindsByCode({
        roomCode,
        userId: req.authSession!.userId,
        smallBlind: payload.smallBlind,
        bigBlind: payload.bigBlind
      });

      res.status(200).json({ room: roomState });
      scheduleBroadcastRoomState(roomCode);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  router.post("/:roomCode/action", async (req: Request, res: Response) => {
    try {
      const { roomCode } = roomCodeParamSchema.parse(req.params);
      const payload = roomActionSchema.parse(req.body);
      const roomState = await applyPlayerActionByRoomCode({
        roomCode,
        userId: req.authSession!.userId,
        actionType: payload.actionType,
        amount: payload.amount
      });

      res.status(200).json({ room: roomState });
      emitRoomActionPatch(roomCode, buildRoomActionPatch(roomState));
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  router.post("/:roomCode/settle", async (req: Request, res: Response) => {
    try {
      const { roomCode } = roomCodeParamSchema.parse(req.params);
      const payload = settleHandSchema.parse(req.body);
      const roomState = await settleHandByRoomCode({
        roomCode,
        userId: req.authSession!.userId,
        winnerUserIds: payload.winnerUserIds
      });

      res.status(200).json({ room: roomState });
      scheduleBroadcastRoomState(roomCode);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  router.post("/:roomCode/next-hand", async (req: Request, res: Response) => {
    try {
      const { roomCode } = roomCodeParamSchema.parse(req.params);
      const payload = nextHandDecisionSchema.parse(req.body);
      const roomState = await decideNextHandByRoomCode({
        roomCode,
        userId: req.authSession!.userId,
        continueSession: payload.continueSession
      });

      res.status(200).json({ room: roomState });
      scheduleBroadcastRoomState(roomCode);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }
      sendRoomError(error, res);
    }
  });

  return router;
}
