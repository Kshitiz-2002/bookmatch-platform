import { Request, Response } from "express";
import * as booksService from "../services/book.service";
import prisma from "../lib/prismaClient";

/**
 * POST /books/upload-url
 */
export async function uploadUrl(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: "fileName required" });

    const result = await booksService.generateSignedUploadUrl(user.id, fileName);
    return res.json(result);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to generate upload url" });
  }
}

/**
 * POST /books
 */
export async function createBook(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const payload = req.body;
    // Basic validation
    if (!payload.title || !Array.isArray(payload.authors)) {
      return res.status(400).json({ error: "title and authors are required" });
    }
    const book = await booksService.createBookRecord({
      title: payload.title,
      authors: payload.authors,
      description: payload.description,
      isbn: payload.isbn,
      categories: payload.categories,
      fileKey: payload.fileKey,
      coverKey: payload.coverKey,
      visibility: payload.visibility
    });

    // Optionally: associate owner, for now we don't store owner in Book model - we can add ownerId if needed
    return res.status(201).json(book);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to create book" });
  }
}

/**
 * GET /books
 */
export async function listBooks(req: Request, res: Response) {
  try {
    const { q, author, category, page, limit, sort } = req.query;
    const r = await booksService.listBooks({
      q: q as string,
      author: author as string,
      category: category as string,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort: (sort as any) || undefined
    });
    return res.json(r);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to list books" });
  }
}

/**
 * GET /books/:id
 */
export async function getBook(req: Request, res: Response) {
  try {
    const book = await booksService.getBookById(req.params.id);
    if (!book || book.deleted) return res.status(404).json({ error: "Not found" });
    // compute avgRating & ratingCount are stored fields on Book (kept in sync on rating)
    return res.json(book);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch book" });
  }
}

/**
 * GET /books/:id/read
 * returns signed download url so client can stream directly from Supabase
 */
export async function readBook(req: Request, res: Response) {
  try {
    const book = await booksService.getBookById(req.params.id);
    if (!book || book.deleted) return res.status(404).json({ error: "Not found" });

    if (book.visibility !== "public") {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Auth required" });
      // owner/admin checks would go here
    }

    if (!book.fileKey) return res.status(404).json({ error: "No file available" });

    const signed = await booksService.createSignedDownloadUrl(book.fileKey);
    // record event: you can push event to queue/redis here (omitted)
    return res.json(signed);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create read url" });
  }
}

/**
 * GET /books/:id/download
 */
export async function downloadBook(req: Request, res: Response) {
  try {
    const book = await booksService.getBookById(req.params.id);
    if (!book || book.deleted) return res.status(404).json({ error: "Not found" });
    if (!book.fileKey) return res.status(404).json({ error: "No file available" });
    const signed = await booksService.createSignedDownloadUrl(book.fileKey, 60 * 60);
    return res.json(signed);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create download url" });
  }
}

/**
 * PATCH /books/:id
 */
export async function updateBook(req: Request, res: Response) {
  try {
    // NOTE: we didn't add ownerId to Book model in the schema above. If we have owner logic, check here.
    const bookId = req.params.id;
    const payload = req.body;
    const allowed: any = {};
    ["title", "authors", "description", "categories", "visibility", "coverKey"].forEach((k) => {
      if (payload[k] !== undefined) allowed[k] = payload[k];
    });
    const book = await prisma.book.update({ where: { id: bookId }, data: allowed });
    return res.json(book);
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({ error: err.message || "Failed to update book" });
  }
}

/**
 * DELETE /books/:id (soft-delete)
 */
export async function deleteBook(req: Request, res: Response) {
  try {
    const bookId = req.params.id;
    await booksService.softDeleteBook(bookId);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete book" });
  }
}
