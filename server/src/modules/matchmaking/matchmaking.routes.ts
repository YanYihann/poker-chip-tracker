import { Router } from "express";
import { z, ZodError } from "zod";
import { requireAuth } from "../auth/session.middleware.js";
import { getMatchState, joinMatchQueue, MATCH_SETTINGS, updateMatchQueue } from "./matchmaking.service.js";
import { scheduleBroadcastRoomState } from "../../realtime/room-broadcast.js";

const ticketSchema = z.object({ ticketId: z.string().uuid() });

export function createMatchmakingRouter() {
  const router = Router();
  router.use(requireAuth);
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

  router.get("/", async (req, res) => {
    try {
      res.json({ match: await getMatchState(req.authSession!.userId), settings: MATCH_SETTINGS });
    } catch (error) {
      console.error("[matchmaking] status unavailable", error);
      res.status(503).json({ message: "Matching is unavailable. Please try again." });
    }
  });

  for (const operation of ["join", "heartbeat", "cancel"] as const) {
    router.post(`/${operation}`, async (req, res) => {
      try {
        const userId = req.authSession!.userId;
        const match = operation === "join"
          ? await joinMatchQueue(userId)
          : await updateMatchQueue(userId, ticketSchema.parse(req.body).ticketId, operation === "cancel");
        res.json({ match, settings: MATCH_SETTINGS });
        if (operation === "join" && match.status === "matched") scheduleBroadcastRoomState(match.roomCode);
      } catch (error) {
        if (error instanceof ZodError) { res.status(400).json({ message: "Invalid match ticket." }); return; }
        console.error(`[matchmaking] ${operation} failed`, error);
        res.status(503).json({ message: "Matching is unavailable. Please try again." });
      }
    });
  }
  return router;
}
