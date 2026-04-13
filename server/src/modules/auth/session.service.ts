import crypto from "node:crypto";

import type { Response } from "express";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

const COOKIE_PATH = "/";

function getSessionMaxAgeMs(): number {
  return env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

function getSessionExpiryDate(): Date {
  return new Date(Date.now() + getSessionMaxAgeMs());
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: getSessionMaxAgeMs()
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH
  });
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createSession(userId: string): Promise<{ token: string }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = getSessionExpiryDate();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  return { token };
}

export async function resolveSession(token: string | undefined): Promise<{
  userId: string;
  tokenId: string;
  tokenHash: string;
} | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    select: {
      id: true,
      userId: true
    }
  });

  if (!session) {
    return null;
  }

  return {
    userId: session.userId,
    tokenId: session.id,
    tokenHash
  };
}

export async function revokeSessionById(tokenId: string): Promise<void> {
  await prisma.refreshToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() }
  });
}
