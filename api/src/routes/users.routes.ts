import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import * as ctrl from "../controllers/users.controller";

const router = Router();

router.get("/me", requireAuth, ctrl.getMe);
router.patch("/me", requireAuth, ctrl.updateMe);
router.get("/:id/recommendations", requireAuth, ctrl.getRecommendations);

export default router;
