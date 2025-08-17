import { Router } from "express";
import * as ctrl from "../controllers/auth.controller";
import { z } from "zod";
import { validate } from "../middlewares/validate.middleware";

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8)
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
});

router.post("/register", validate(registerSchema), ctrl.register);
router.post("/login", validate(loginSchema), ctrl.login);
router.post("/refresh", ctrl.refresh); // body: { refreshToken }
router.post("/logout", ctrl.logout);

export default router;
