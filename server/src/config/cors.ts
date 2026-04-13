import { env } from "./env.js";

const allowedOrigins = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const privateOriginPattern =
  /^https?:\/\/(?:(?:localhost|127(?:\.\d{1,3}){3})|(?:10(?:\.\d{1,3}){3})|(?:192\.168(?:\.\d{1,3}){2})|(?:172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}))(?::\d{1,5})?$/;

function isDevPrivateOrigin(origin: string): boolean {
  return env.NODE_ENV !== "production" && privateOriginPattern.test(origin);
}

export function isAllowedClientOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return isDevPrivateOrigin(origin);
}

export function resolveCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void
): void {
  if (isAllowedClientOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS blocked origin: ${origin ?? "unknown"}`));
}
