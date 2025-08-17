import { Request, Response } from "express";
import * as authService from "../services/auth.service";

/**
 * Register: create user + tokens
 */
export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body;
  const result = await authService.register({ name, email, password });
  return res.status(201).json(result);
}

/**
 * Login
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  return res.json(result);
}

/**
 * Refresh access token using refresh token
 * Body: { refreshToken }
 */
export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
  const result = await authService.refresh({ refreshToken });
  return res.json(result);
}

/**
 * Logout (revoke refresh token if provided)
 */
export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body;
  await authService.logout({ refreshToken });
  return res.json({ ok: true });
}
