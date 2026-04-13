import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env.js";
import { clearSessionCookie, resolveSession } from "./session.service.js";

export async function attachAuthSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
    const session = await resolveSession(token);

    if (!session && token) {
      clearSessionCookie(res);
    }

    req.authSession = session;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.authSession) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  next();
}
