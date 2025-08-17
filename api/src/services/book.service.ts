import prisma from "../prisma/client";
import * as storage from "./storage.service";

/**
 * Book service: file keys are expected to be objectKey strings stored in Supabase bucket.
 */
export default {
  async createUploadUrl({ userId, fileName }: { userId: string; fileName: string; contentType?: string; size?: number }) {
    // For server-side uploads we'll return an objectKey and expect client to POST file to server which uploads using service key.
    // But keep objectKey generation consistent.
    const objectKey = `${userId}/${Date.now()}_${fileName.replace(/\s+/g, "_")}`;
    // alternative: return objectKey and let client call server endpoint that uploads
    return { uploadUrl: null, objectKey };
  },

  async create(data: {
    title: string;
    authors: string[];
    description?: string;
    isbn?: string;
    categories?: string[];
    fileKey: string;
    coverKey?: string;
    visibility?: string;
    ownerId: string;
  }) {
    const book = await prisma.book.create({
      data: {
        title: data.title,
        authors: data.authors,
        description: data.description ?? null,
        isbn: data.isbn ?? null,
        categories: data.categories ?? [],
        fileKey: data.fileKey,
        coverKey: data.coverKey ?? null,
        visibility: data.visibility ?? "public",
        ownerId: data.ownerId
      }
    });
    return book;
  },

  async list({ q, page = 1, limit = 20 }: { q?: string; page?: number; limit?: number }) {
    const where: any = { deleted: false, visibility: "public" };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await prisma.$transaction([
      prisma.book.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }]
      }),
      prisma.book.count({ where })
    ]);
    return { total, page, limit, items };
  },

  async findById(id: string) {
    return prisma.book.findUnique({ where: { id } });
  },

  async update(id: string, userId: string, updates: Partial<any>) {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) throw { status: 404, message: "Not found" };
    if (book.ownerId !== userId) throw { status: 403, message: "Forbidden" };
    return prisma.book.update({ where: { id }, data: updates });
  },

  async remove(id: string, userId: string) {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) throw { status: 404, message: "Not found" };
    if (book.ownerId !== userId) throw { status: 403, message: "Forbidden" };
    // soft delete
    return prisma.book.update({ where: { id }, data: { deleted: true } });
  },

  async getReadUrl(id: string, requesterId?: string) {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) throw { status: 404, message: "Not found" };
    if (book.visibility !== "public") {
      if (!requesterId || (requesterId !== book.ownerId)) throw { status: 403, message: "Forbidden" };
    }
    const { url } = await storage.createSignedDownloadUrl(book.fileKey, 60 * 10);
    return { url };
  },

  async getDownloadUrl(id: string, requesterId?: string) {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) throw { status: 404, message: "Not found" };
    if (book.visibility !== "public") {
      if (!requesterId || (requesterId !== book.ownerId)) throw { status: 403, message: "Forbidden" };
    }
    const { url } = await storage.createSignedDownloadUrl(book.fileKey, 60 * 60);
    return { url };
  }
};
