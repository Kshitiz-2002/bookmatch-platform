import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validate.middleware";
import { requireAuth } from "../middlewares/auth.middleware";
import * as ctrl from "../controllers/books.controller";

const router = Router();

const uploadUrlSchema = z.object({
  body: z.object({
    fileName: z.string().min(1),
    contentType: z.string().min(1),
    size: z.number().int().positive().optional()
  })
});

router.post("/upload-url", requireAuth, validate(uploadUrlSchema), ctrl.getUploadUrl);
router.post("/", requireAuth, ctrl.createBook);
router.get("/", ctrl.listBooks);
router.get("/:id", ctrl.getBook);
router.patch("/:id", requireAuth, ctrl.updateBook);
router.delete("/:id", requireAuth, ctrl.deleteBook);
router.get("/:id/read", requireAuth, ctrl.readBook); // require auth for read (controller will check visibility)
router.get("/:id/download", requireAuth, ctrl.downloadBook);

export default router;
