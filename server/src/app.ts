import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { resolveCorsOrigin } from "./config/cors.js";
import { attachAuthSession } from "./modules/auth/session.middleware.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createProfileRouter } from "./modules/profile/profile.routes.js";
import { createRoomRouter } from "./modules/rooms/room.routes.js";
import { registerHealthRoute } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: resolveCorsOrigin,
      credentials: true
    })
  );
  app.use(cookieParser());
  app.use(express.json());
  app.use(attachAuthSession);

  app.get("/", (_req, res) => {
    res.status(200).json({
      service: "poker-chip-tracker-server",
      status: "running"
    });
  });

  app.use("/api/auth", createAuthRouter());
  app.use("/api/profile", createProfileRouter());
  app.use("/api/rooms", createRoomRouter());
  registerHealthRoute(app);

  return app;
}
