import prisma from "../lib/prismaClient";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const DEFAULT_BUCKET = process.env.DEFAULT_BUCKET || "books";

const supabase: SupabaseClient | null = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

if (!supabase) {
  console.warn("Supabase client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env");
}

/**
 * Create a signed upload URL (Supabase storage token).
 * Returns objectKey (path) and signed upload metadata for the client.
 */
export async function generateSignedUploadUrl(userId: string, fileName: string, bucket = DEFAULT_BUCKET) {
  if (!supabase) throw new Error("Supabase storage not configured");

  const objectKey = `uploads/${userId}/${uuidv4()}/${fileName}`;

  // createSignedUploadUrl returns a token the client can use to upload directly via SDK
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectKey);
  if (error) throw error;

  return { objectKey, signedUploadData: data };
}

/**
 * Create signed download URL (for clients to fetch file directly)
 */
export async function createSignedDownloadUrl(objectKey: string, expires = 60 * 60, bucket = DEFAULT_BUCKET) {
  if (!supabase) throw new Error("Supabase storage not configured");
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectKey, expires);
  if (error) throw error;
  return data; // contains signedUrl
}

/**
 * Create book metadata (after upload)
 */
export async function createBookRecord(payload: {
  title: string;
  authors: string[];
  description?: string;
  isbn?: string;
  categories?: string[];
  fileKey?: string;
  coverKey?: string;
  visibility?: "public" | "private";
}) {
  const book = await prisma.book.create({
    data: {
      title: payload.title,
      authors: payload.authors,
      description: payload.description || "",
      isbn: payload.isbn,
      categories: payload.categories || [],
      fileKey: payload.fileKey,
      coverKey: payload.coverKey,
      visibility: payload.visibility || "public"
    }
  });
  return book;
}

/**
 * Soft-delete book
 */
export async function softDeleteBook(bookId: string) {
  return prisma.book.update({ where: { id: bookId }, data: { deleted: true }});
}

/**
 * Basic listing with filters & pagination
 */
export async function listBooks(params: {
  q?: string;
  author?: string;
  category?: string;
  page?: number;
  limit?: number;
  sort?: "popular" | "new" | "rating";
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.BookWhereInput = { deleted: false, visibility: "public" };

  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } }
    ];
  }
  if (params.author) where.authors = { has: params.author };
  if (params.category) where.categories = { has: params.category };

  // build orderBy with explicit Prisma types to satisfy compiler
  let orderBy: Prisma.BookOrderByWithRelationInput;

  if (params.sort === "new") {
    orderBy = { createdAt: "desc" as Prisma.SortOrder };
  } else if (params.sort === "rating") {
    orderBy = { avgRating: "desc" as Prisma.SortOrder };
  } else if (params.sort === "popular") {
    orderBy = { ratingCount: "desc" as Prisma.SortOrder };
  } else {
    orderBy = { createdAt: "desc" as Prisma.SortOrder };
  }

  const [items, total] = await Promise.all([
    prisma.book.findMany({ where, orderBy, skip, take: limit }),
    prisma.book.count({ where })
  ]);

  return { total, page, limit, items };
}

/**
 * Get a single book (no visibility enforcement here; caller must enforce owner/admin checks)
 */
export async function getBookById(bookId: string) {
  return prisma.book.findUnique({ where: { id: bookId }});
}
