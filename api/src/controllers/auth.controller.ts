import { Request, Response } from "express";
import * as authService from "../services/auth.service";

/**
 * Helper to handle async errors (small wrapper)
 */
function handleError(res: Response, err: any) {
  console.error(err);
  if (err.message && err.message.includes("Invalid")) return res.status(401).json({ error: err.message });
  return res.status(400).json({ error: err.message || "Bad Request" });
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: "Invalid email or password (min 6 chars)" });
    }
    const result = await authService.registerUser(name, email, password);
    return res.status(201).json(result);
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    const result = await authService.loginUser(email, password);
    return res.json(result);
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
    const result = await authService.refreshAccessToken(refreshToken);
    return res.json(result);
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
    const ok = await authService.revokeRefreshToken(refreshToken);
    if (!ok) return res.status(400).json({ error: "Invalid refreshToken or already revoked" });
    return res.json({ ok: true });
  } catch (err: any) {
    return handleError(res, err);
  }
}
