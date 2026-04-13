import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
const COOKIE_PATH = "/";
function getSessionMaxAgeMs() {
    return env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}
function getSessionExpiryDate() {
    return new Date(Date.now() + getSessionMaxAgeMs());
}
export function setSessionCookie(res, token) {
    res.cookie(env.SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: COOKIE_PATH,
        maxAge: getSessionMaxAgeMs()
    });
}
export function clearSessionCookie(res) {
    res.clearCookie(env.SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: COOKIE_PATH
    });
}
export function hashSessionToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
function generateSessionToken() {
    return crypto.randomBytes(32).toString("base64url");
}
export async function createSession(userId) {
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
export async function resolveSession(token) {
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
export async function revokeSessionById(tokenId) {
    await prisma.refreshToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() }
    });
}
