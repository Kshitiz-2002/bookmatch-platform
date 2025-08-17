import { Router } from "express";
import * as AuthController from "../../controllers/auth.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

const router = Router();

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password }
 */
router.post("/register", AuthController.register);

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 */
router.post("/login", AuthController.login);

/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken }
 */
router.post("/refresh", AuthController.refresh);

/**
 * POST /api/v1/auth/logout
 * Protected
 * Body: { refreshToken }
 */
router.post("/logout", requireAuth, AuthController.logout);

export default router;
