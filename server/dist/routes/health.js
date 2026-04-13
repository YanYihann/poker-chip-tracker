import { prisma } from "../lib/prisma.js";
export function registerHealthRoute(app) {
    app.get("/health", async (_req, res) => {
        try {
            await prisma.$queryRaw `SELECT 1`;
            res.status(200).json({ status: "ok", database: "up" });
        }
        catch (error) {
            res.status(503).json({
                status: "degraded",
                database: "down",
                message: error instanceof Error ? error.message : "unknown error"
            });
        }
    });
}
