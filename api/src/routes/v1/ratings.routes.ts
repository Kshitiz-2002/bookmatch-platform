import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import * as RatingsController from "../../controllers/ratings.controller";

const router = Router();

/**
 * POST /api/v1/ratings/:bookId/rate
 * Body: { rating: number }
 */
router.post("/:bookId/rate", requireAuth, RatingsController.rateBook);

/**
 * GET /api/v1/ratings/:bookId
 * Query: page, limit
 */
router.get("/:bookId", RatingsController.listRatings);

/**
 * POST /api/v1/ratings/:bookId/review
 * Body: { content, isSpoiler }
 */
router.post("/:bookId/review", requireAuth, RatingsController.createReview);

export default router;
