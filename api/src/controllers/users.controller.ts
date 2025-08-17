import { Response } from "express";
import userService from "../services/user.service";
import { AuthRequest } from "../middlewares/auth.middleware";

/**
 * GET /users/me
 */
export async function getMe(req: AuthRequest, res: Response) {
  const id = req.user!.id;
  const user = await userService.findById(id);
  return res.json(user);
}

/**
 * PATCH /users/me
 */
export async function updateMe(req: AuthRequest, res: Response) {
  const id = req.user!.id;
  const updates = req.body;
  const updated = await userService.update(id, updates);
  return res.json(updated);
}

/**
 * GET /users/:id/recommendations?n=20
 */
export async function getRecommendations(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const n = Number(req.query.n ?? 20);
  // only allow user to fetch own or admins (guard)
  if (req.user!.id !== id && !req.user!.roles.includes("admin")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const items = await userService.getRecommendations(id, n);
  return res.json({ items });
}
