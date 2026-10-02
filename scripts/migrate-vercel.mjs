import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Local builds stay offline. Only a production Vercel build applies migrations.
if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production") {
  const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  const directUrl = process.env.NEON_DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL_DIRECT ?? databaseUrl;
  if (!databaseUrl || !directUrl || ["localhost", "127.0.0.1"].includes(new URL(directUrl).hostname)) {
    throw new Error("Connect a production PostgreSQL database before deploying.");
  }
  const migration = spawnSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", "server/prisma/schema.prisma"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_URL_DIRECT: directUrl }
  });
  if (migration.error) throw migration.error;
  if (migration.status !== 0) process.exit(migration.status ?? 1);
}
