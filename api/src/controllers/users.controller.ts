import { Request, Response } from "express";
import prisma from "../lib/prismaClient";
import * as recsGateway from "../services/recs.gateway";

/**
 * GET /users/me
 */
export async function me(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, roles: true, createdAt: true }});
    return res.json(dbUser);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
}

/**
 * PATCH /users/me
 */
export async function updateMe(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const payload: any = {};
    if (req.body.name) payload.name = req.body.name;
    // disallow email/password here; create separate endpoints to change password/email with verification
    const updated = await prisma.user.update({ where: { id: user.id }, data: payload, select: { id: true, name: true, email: true, roles: true }});
    return res.json(updated);
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({ error: err.message || "Failed to update profile" });
  }
}

/**
 * GET /users/:id/recommendations?n=20
 * Only allow same user or admin - simple check
 */
export async function recommendations(req: Request, res: Response) {
  try {
    const requestedUserId = req.params.id;
    const authUser = (req as any).user;
    if (!authUser) return res.status(401).json({ error: "Not authenticated" });
    if (authUser.id !== requestedUserId && !authUser.roles.includes("admin")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const n = Math.min(100, Number(req.query.n || 20));
    const items = await recsGateway.getUserRecommendations(requestedUserId, n);
    return res.json({ items });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
}
