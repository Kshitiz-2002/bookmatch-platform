import { Request, Response } from "express";
import prisma from "../lib/prismaClient";
import * as recsGateway from "../services/recs.gateway";

/**
 * POST /ratings/:bookId/rate
 * Body: { rating }
 */
export async function rateBook(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const bookId = req.params.bookId;
    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "rating must be 1..5" });

    // upsert rating
    const existing = await prisma.rating.findUnique({ where: { userId_bookId: { userId: user.id, bookId } } }).catch(() => null);

    if (existing) {
      await prisma.rating.update({ where: { id: existing.id }, data: { rating } });
    } else {
      await prisma.rating.create({ data: { userId: user.id, bookId, rating } });
    }

    // Recompute avgRating/ratingCount (simple approach)
    const agg = await prisma.rating.aggregate({
      where: { bookId },
      _avg: { rating: true },
      _count: { rating: true }
    });

    await prisma.book.update({
      where: { id: bookId },
      data: {
        avgRating: (agg._avg.rating ?? 0),
        ratingCount: agg._count.rating ?? 0
      }
    });

    // Invalidate user recs cache for this user
    await recsGateway.invalidateUserRecs(user.id);

    return res.json({ ok: true, avgRating: agg._avg.rating, ratingCount: agg._count.rating });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to rate book" });
  }
}

/**
 * GET /ratings/:bookId
 */
export async function listRatings(req: Request, res: Response) {
  try {
    const bookId = req.params.bookId;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Number(req.query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.rating.findMany({
        where: { bookId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true } } }
      }),
      prisma.rating.count({ where: { bookId } })
    ]);

    return res.json({ total, page, limit, items });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to list ratings" });
  }
}

/**
 * POST /ratings/:bookId/review
 * Body: { content, isSpoiler }
 * NOTE: Reviews model not present in Prisma schema above; this is a placeholder example.
 */
export async function createReview(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    // If you have Review model create it; for now we just echo the payload
    const { content, isSpoiler } = req.body;
    if (!content || content.length < 2) return res.status(400).json({ error: "Review content required" });

    // Push event to queue or record review in DB (omitted)
    return res.status(201).json({ ok: true, content, isSpoiler });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create review" });
  }
}
