import { Request, Response } from "express";
import bookService from "../services/book.service";
import { AuthRequest } from "../middlewares/auth.middleware";

/**
 * POST /books/upload-url
 */
export async function getUploadUrl(req: AuthRequest, res: Response) {
  const { fileName, contentType, size } = req.body;
  const result = await bookService.createUploadUrl({ userId: req.user!.id, fileName, contentType, size });
  return res.status(201).json(result);
}

/**
 * POST /books
 */
export async function createBook(req: AuthRequest, res: Response) {
  const payload = req.body;
  payload.ownerId = req.user!.id;
  const book = await bookService.create(payload);
  return res.status(201).json(book);
}

/**
 * GET /books
 */
export async function listBooks(req: Request, res: Response) {
  const q = String(req.query.q || "");
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const result = await bookService.list({ q, page, limit });
  return res.json(result);
}

/**
 * GET /books/:id
 */
export async function getBook(req: AuthRequest, res: Response) {
  const book = await bookService.findById(req.params.id);
  if (!book || book.deleted) return res.status(404).json({ error: "Not found" });

  if (book.visibility !== "public") {
    // visibility: only owner or admin
    const authUserId = req.user?.id;
    if (!authUserId || (authUserId !== book.ownerId && !(req.user?.roles ?? []).includes("admin"))) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  return res.json(book);
}

/**
 * PATCH /books/:id
 */
export async function updateBook(req: AuthRequest, res: Response) {
  const updated = await bookService.update(req.params.id, req.user!.id, req.body);
  return res.json(updated);
}

/**
 * DELETE /books/:id
 */
export async function deleteBook(req: AuthRequest, res: Response) {
  await bookService.remove(req.params.id, req.user!.id);
  return res.status(204).send();
}

/**
 * GET /books/:id/read -> returns signed URL for streaming/reading
 */
export async function readBook(req: AuthRequest, res: Response) {
  const { url } = await bookService.getReadUrl(req.params.id, req.user?.id);
  // Respond with redirect to signed URL for direct client download/stream
  return res.redirect(url);
}

/**
 * GET /books/:id/download -> returns signed download url JSON
 */
export async function downloadBook(req: AuthRequest, res: Response) {
  const { url } = await bookService.getDownloadUrl(req.params.id, req.user?.id);
  return res.json({ url });
}
