import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/jwt.middleware";
import * as RecsController from "../../controllers/recs.controller";

const router = Router();

/**
 * GET /api/v1/recs/user/:userId/top?n=20
 */
router.get("/user/:userId/top", requireAuth, RecsController.userTop);

/**
 * GET /api/v1/recs/book/:bookId/similar?n=10
 */
router.get("/book/:bookId/similar", RecsController.bookSimilar);

/**
 * POST /api/v1/recs/train
 * Admin only
 */
router.post("/train", requireAuth, requireRole("admin"), RecsController.trainJob);

/**
 * GET /api/v1/recs/status/:jobId
 * Admin only
 */
router.get("/status/:jobId", requireAuth, requireRole("admin"), RecsController.jobStatus);

export default router;
