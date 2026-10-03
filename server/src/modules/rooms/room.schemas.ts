import { z } from "zod";

const roomCodePattern = /^\d{4}$/;

export const createRoomSchema = z.object({
  mode: z.enum(["local", "online"]).optional(),
  maxPlayers: z.number().int().min(2).max(10).optional(),
  startingStack: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  smallBlind: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  bigBlind: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional()
}).refine((value) => (value.bigBlind ?? 200) >= (value.smallBlind ?? 100), {
  message: "Big blind must be at least the small blind.", path: ["bigBlind"]
}).refine((value) => (value.startingStack ?? 10000) >= (value.bigBlind ?? 200), {
  message: "Starting chips must be at least the big blind.", path: ["startingStack"]
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

export const setSeatSchema = z.object({
  seatIndex: z.number().int().min(0).max(9).nullable()
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
