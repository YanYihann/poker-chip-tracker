import type { Express, Request, Response } from "express";

import { prisma } from "../lib/prisma.js";

export function registerHealthRoute(app: Express): void {
  app.get("/health", async (_req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: "ok", database: "up" });
    } catch (error) {
      res.status(503).json({
        status: "degraded",
        database: "down",
        message: error instanceof Error ? error.message : "unknown error"
      });
    }
  });
}
