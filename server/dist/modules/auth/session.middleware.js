import { env } from "../../config/env.js";
import { clearSessionCookie, resolveSession } from "./session.service.js";
export async function attachAuthSession(req, res, next) {
    try {
        const token = req.cookies?.[env.SESSION_COOKIE_NAME];
        const session = await resolveSession(token);
        if (!session && token) {
            clearSessionCookie(res);
        }
        req.authSession = session;
        next();
    }
    catch (error) {
        next(error);
    }
}
export function requireAuth(req, res, next) {
    if (!req.authSession) {
        res.status(401).json({ message: "Authentication required." });
        return;
    }
    next();
}
