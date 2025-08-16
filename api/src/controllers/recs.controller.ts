import { Request, Response } from "express";
import * as recsGateway from "../services/recs.gateway";

/**
 * GET /recs/user/:userId/top
 */
export async function userTop(req: Request, res: Response) {
  try {
    const userId = req.params.userId;
    const auth = (req as any).user;
    if (!auth) return res.status(401).json({ error: "Not authenticated" });
    if (auth.id !== userId && !auth.roles.includes("admin")) return res.status(403).json({ error: "Forbidden" });

    const n = Math.min(100, Number(req.query.n || 20));
    const items = await recsGateway.getUserRecommendations(userId, n);
    return res.json({ items });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
}

/**
 * GET /recs/book/:bookId/similar
 */
export async function bookSimilar(req: Request, res: Response) {
  try {
    const bookId = req.params.bookId;
    const n = Math.min(100, Number(req.query.n || 10));
    const items = await recsGateway.getSimilarBooks(bookId, n);
    return res.json(items);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch similar books" });
  }
}

/**
 * POST /recs/train
 * This enqueues a training job (worker picks it up)
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

const redisConnection = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
const trainQueue = new Queue("recs-train", { connection: redisConnection });

export async function trainJob(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const job = await trainQueue.add("train", { full: !!body.full, requestedBy: (req as any).user?.id || null });
    return res.status(202).json({ jobId: job.id });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to enqueue training job" });
  }
}

/**
 * GET /recs/status/:jobId
 * Very small helper that reads job state (requires bullmq)
 */
import { Job } from "bullmq";
export async function jobStatus(req: Request, res: Response) {
  try {
    const jobId = req.params.jobId;
    const bq = trainQueue;
    const job = await bq.getJob(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const state = await job.getState();
    const progress = job.progress || 0;
    return res.json({ id: job.id, state, progress, data: job.data, failedReason: job.failedReason });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch job status" });
  }
}
