import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { id: string; roles: string[] };
}

/**
 * Protect route with JWT access token.
 * Access token payload should include `sub` (user id) and `roles`.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = h.split(" ")[1];
  try {
    const secret = process.env.JWT_SECRET || "";
    const payload = jwt.verify(token, secret) as any;
    req.user = { id: payload.sub, roles: payload.roles ?? ["user"] };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Role guard factory.
 */
export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!req.user.roles.includes(role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
