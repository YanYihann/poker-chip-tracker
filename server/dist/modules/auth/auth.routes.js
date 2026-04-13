import { Router } from "express";
import { ZodError } from "zod";
import { getAuthenticatedUser, registerUser, verifyUserLogin } from "./auth.service.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";
import { clearSessionCookie, createSession, revokeSessionById, setSessionCookie } from "./session.service.js";
function sendValidationError(error, res) {
    res.status(400).json({
        message: "Invalid request body.",
        issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
        }))
    });
}
export function createAuthRouter() {
    const router = Router();
    router.post("/register", async (req, res) => {
        try {
            const payload = registerSchema.parse(req.body);
            const user = await registerUser(payload);
            const { token } = await createSession(user.id);
            setSessionCookie(res, token);
            res.status(201).json({ user });
        }
        catch (error) {
            if (error instanceof ZodError) {
                sendValidationError(error, res);
                return;
            }
            if (error instanceof Error && error.message === "EMAIL_EXISTS") {
                res.status(409).json({ message: "Email already exists." });
                return;
            }
            if (error instanceof Error && error.message === "USERNAME_EXISTS") {
                res.status(409).json({ message: "Username already exists." });
                return;
            }
            res.status(500).json({ message: "Unable to register user." });
        }
    });
    router.post("/login", async (req, res) => {
        try {
            const payload = loginSchema.parse(req.body);
            const user = await verifyUserLogin(payload);
            const { token } = await createSession(user.id);
            setSessionCookie(res, token);
            res.status(200).json({ user });
        }
        catch (error) {
            if (error instanceof ZodError) {
                sendValidationError(error, res);
                return;
            }
            if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
                res.status(401).json({ message: "Invalid email or password." });
                return;
            }
            res.status(500).json({ message: "Unable to login." });
        }
    });
    router.post("/logout", async (req, res) => {
        try {
            if (req.authSession) {
                await revokeSessionById(req.authSession.tokenId);
            }
            clearSessionCookie(res);
            res.status(200).json({ ok: true });
        }
        catch {
            res.status(500).json({ message: "Unable to logout." });
        }
    });
    router.get("/me", async (req, res) => {
        if (!req.authSession) {
            res.status(401).json({ message: "Not authenticated." });
            return;
        }
        const user = await getAuthenticatedUser(req.authSession.userId);
        if (!user) {
            res.status(401).json({ message: "Not authenticated." });
            return;
        }
        res.status(200).json({ user });
    });
    return router;
}
