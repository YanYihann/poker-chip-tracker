import { createServer } from "node:http";

import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { createApp } from "./app.js";
import { setupSocketServer } from "./realtime/socket.js";

const app = createApp();
const httpServer = createServer(app);
setupSocketServer(httpServer);

const server = httpServer.listen(env.PORT, "0.0.0.0", () => {
  console.log(`[server] listening on http://0.0.0.0:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] received ${signal}, shutting down...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
