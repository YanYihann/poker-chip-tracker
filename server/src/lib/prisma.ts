import { PrismaClient } from "@prisma/client";

type GlobalWithPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};

const globalWithPrisma = globalThis as GlobalWithPrisma;

function logDatabaseUrlPoolHints(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  try {
    const parsedUrl = new URL(databaseUrl);
    const host = parsedUrl.hostname.toLowerCase();
    const isLikelyNeon = host.includes("neon.tech");
    const hasConnectionLimit = parsedUrl.searchParams.has("connection_limit");
    const usesPoolerHost =
      host.includes("-pooler.") || host.includes(".pooler.") || host.includes("pooler");

    if (isLikelyNeon && !usesPoolerHost) {
      console.warn(
        "[prisma] DATABASE_URL is not using a Neon pooler host. Use the '-pooler' endpoint for runtime traffic."
      );
    }

    if (!hasConnectionLimit) {
      console.warn(
        "[prisma] DATABASE_URL is missing 'connection_limit'. Set a conservative value (for example 10) to reduce queue jitter."
      );
    }
  } catch {
    console.warn("[prisma] DATABASE_URL is not a valid URL string.");
  }
}

logDatabaseUrlPoolHints();

export const prisma =
  globalWithPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalWithPrisma.prisma = prisma;
}
