import { Router } from "express";
import { requireAuth } from "../../middleware/jwt.middleware";
import * as UsersController from "../../controllers/users.controller";

const router = Router();

/**
 * GET /api/v1/users/me
 */
router.get("/me", requireAuth, UsersController.me);

/**
 * PATCH /api/v1/users/me
 * Body: partial user updates (e.g., name)
 */
router.patch("/me", requireAuth, UsersController.updateMe);

/**
 * GET /api/v1/users/:id/recommendations?n=20
 */
router.get("/:id/recommendations", requireAuth, UsersController.recommendations);

export default router;
