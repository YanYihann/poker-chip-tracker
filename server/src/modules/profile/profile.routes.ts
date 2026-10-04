import type { Request, Response } from "express";
import { Router } from "express";
import { z, ZodError } from "zod";

import { requireAuth } from "../auth/session.middleware.js";
import { roomCodeParamSchema } from "../rooms/room.schemas.js";
import { sessionIdParamSchema, updateProfileSchema } from "./profile.schemas.js";
import { getProfile, getRecentSessions, getSessionDetail, getSessionDetailByRoomCode, resetProfileHistory, updateProfile } from "./profile.service.js";

function sendValidationError(error: ZodError, res: Response): void {
  res.status(400).json({
    message: "Invalid request body.",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  });
}

export function createProfileRouter() {
  const router = Router();

  router.get("/", requireAuth, async (req: Request, res: Response) => {
    try {
      const profile = await getProfile(req.authSession!.userId);
      res.status(200).json({ profile });
    } catch (error) {
      if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
        res.status(404).json({ message: "Profile not found." });
        return;
      }
      res.status(500).json({ message: "Unable to load profile." });
    }
  });

  router.patch("/", requireAuth, async (req: Request, res: Response) => {
    try {
      const payload = updateProfileSchema.parse(req.body);
      const profile = await updateProfile(req.authSession!.userId, payload);
      res.status(200).json({ profile });
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }

      if (error instanceof Error && error.message === "USERNAME_EXISTS") {
        res.status(409).json({ message: "Username already exists." });
        return;
      }

      res.status(500).json({ message: "Unable to update profile." });
    }
  });

  router.get("/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const mode = z.enum(["local", "online"]).optional().parse(req.query.mode);
      const sessions = await getRecentSessions(req.authSession!.userId, mode);
      res.status(200).json({ sessions });
    } catch (error) {
      if (error instanceof ZodError) { sendValidationError(error, res); return; }
      res.status(500).json({ message: "Unable to load recent sessions." });
    }
  });

  router.post("/reset", requireAuth, async (req: Request, res: Response) => {
    try {
      const profile = await resetProfileHistory(req.authSession!.userId);
      res.status(200).json({ profile });
    } catch { res.status(500).json({ message: "Unable to reset history. Please try again." }); }
  });

  router.get("/sessions/:sessionId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { sessionId } = sessionIdParamSchema.parse(req.params);
      const session = await getSessionDetail({
        userId: req.authSession!.userId,
        sessionId
      });
      res.status(200).json({ session });
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(error, res);
        return;
      }

      if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
        res.status(404).json({ message: "Session not found." });
        return;
      }

      if (error instanceof Error && error.message === "SESSION_FORBIDDEN") {
        res.status(403).json({ message: "You do not have access to this session." });
        return;
      }

      res.status(500).json({ message: "Unable to load session detail." });
    }
  });

  router.get("/rooms/:roomCode/session", requireAuth, async (req: Request, res: Response) => {
    try {
      const { roomCode } = roomCodeParamSchema.parse(req.params);
      const session = await getSessionDetailByRoomCode({ userId: req.authSession!.userId, roomCode });
      res.status(200).json({ session });
    } catch (error) {
      if (error instanceof ZodError) { sendValidationError(error, res); return; }
      if (error instanceof Error && error.message === "SESSION_NOT_FOUND") { res.status(404).json({ message: "Session not found." }); return; }
      if (error instanceof Error && error.message === "SESSION_FORBIDDEN") { res.status(403).json({ message: "You do not have access to this session." }); return; }
      res.status(500).json({ message: "Unable to load session settlement." });
    }
  });

  return router;
}
