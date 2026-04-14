import { z } from "zod";

const roomCodePattern = /^\d{4}$/;

export const createRoomSchema = z.object({
  mode: z.enum(["local", "online"]).optional(),
  maxPlayers: z.number().int().min(2).max(10).optional(),
  startingStack: z.number().int().positive().optional(),
  smallBlind: z.number().int().positive().optional(),
  bigBlind: z.number().int().positive().optional()
});

export const joinRoomSchema = z.object({
  roomCode: z.string().toUpperCase().regex(roomCodePattern),
  displayName: z.string().trim().min(2).max(24).optional()
});

export const setReadySchema = z.object({
  isReady: z.boolean()
});

export const setBuyInSchema = z.object({
  buyIn: z.number().int().positive()
});

export const roomActionSchema = z.object({
  actionType: z.enum(["fold", "check", "call", "bet", "raise", "all-in"]),
  amount: z.number().int().positive().optional()
});

export const updateBlindsSchema = z
  .object({
    smallBlind: z.number().int().positive(),
    bigBlind: z.number().int().positive()
  })
  .refine((value) => value.bigBlind >= value.smallBlind, {
    message: "Big blind must be greater than or equal to small blind.",
    path: ["bigBlind"]
  });

export const settleHandSchema = z.object({
  winnerUserIds: z.array(z.string().uuid()).default([])
});

export const nextHandDecisionSchema = z.object({
  continueSession: z.boolean()
});

export const roomCodeParamSchema = z.object({
  roomCode: z.string().toUpperCase().regex(roomCodePattern)
});
