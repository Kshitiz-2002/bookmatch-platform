import { Router } from "express";
import { requireAuth } from "../../middleware/jwt.middleware";
import * as BooksController from "../../controllers/books.controller";

const router = Router();

/**
 * POST /api/v1/books/upload-url
 * Body: { fileName }
 */
router.post("/upload-url", requireAuth, BooksController.uploadUrl);

/**
 * POST /api/v1/books
 * Body: book metadata (title, authors[], fileKey, ...)
 */
router.post("/", requireAuth, BooksController.createBook);

/**
 * GET /api/v1/books
 * Query: q, author, category, page, limit, sort
 */
router.get("/", BooksController.listBooks);

/**
 * GET /api/v1/books/:id
 */
router.get("/:id", BooksController.getBook);

/**
 * GET /api/v1/books/:id/read
 * Returns a signed URL for client to stream/download
 */
router.get("/:id/read", BooksController.readBook);

/**
 * GET /api/v1/books/:id/download
 */
router.get("/:id/download", BooksController.downloadBook);

/**
 * PATCH /api/v1/books/:id
 * Protected: owner/admin - here we simply requireAuth; controller will check owner
 */
router.patch("/:id", requireAuth, BooksController.updateBook);

/**
 * DELETE /api/v1/books/:id
 */
router.delete("/:id", requireAuth, BooksController.deleteBook);

export default router;
