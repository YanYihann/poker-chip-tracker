import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

// Vercel's Neon integration uses a prefix when DATABASE_URL already exists.
if (process.env.NEON_DATABASE_URL) {
  const runtimeUrl = new URL(process.env.NEON_DATABASE_URL);
  if (!runtimeUrl.searchParams.has("connection_limit")) runtimeUrl.searchParams.set("connection_limit", "2");
  process.env.DATABASE_URL = runtimeUrl.toString();
  process.env.DATABASE_URL_DIRECT = process.env.NEON_DATABASE_URL_UNPOOLED ?? process.env.NEON_DATABASE_URL;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4001),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  SESSION_COOKIE_NAME: z.string().default("poker_chip_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_DIRECT: z.string().min(1).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsed.data;
