import prisma from '../lib/prisma';
import { getPresignedUrl, getSignedUrl } from '../utils/supabase';
import logger from '../lib/logger';
import { redis } from '../lib/redis';
import type { Book, Prisma, Visibility } from '@prisma/client';
import { HttpException } from '../errors/HttpException';

const CACHE_TTL = 300; // 5 minutes

class BookService {
  async getPresignedUrl(fileName: string, contentType: string, size: number) {
    return getPresignedUrl(fileName, contentType, size);
  }

  async createBook(userId: string, data: Prisma.BookCreateInput) {
    // Validate ownership of file keys
    await this.validateFileOwnership(userId, data.fileKey);
    if (data.coverKey) {
      await this.validateFileOwnership(userId, data.coverKey);
    }

    // Create book
    return prisma.book.create({
      data: {
        ...data,
        user: { connect: { id: userId } }
      },
      include: { user: { select: { id: true, name: true } } }
    });
  }

  async getBooks(params: {
    query?: string;
    author?: string;
    category?: string;
    page: number;
    limit: number;
    sort: 'popular' | 'new' | 'rating';
  }) {
    const { query, author, category, page, limit, sort } = params;
    const skip = (page - 1) * limit;
    
    // Generate cache key
    const cacheKey = `books:${query || ''}:${author || ''}:${category || ''}:${page}:${limit}:${sort}`;
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Build where clause
    const where: Prisma.BookWhereInput = {
      deletedAt: null,
      visibility: 'PUBLIC'
    };
    
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ];
    }
    
    if (author) {
      where.authors = { hasSome: [author] };
    }
    
    if (category) {
      where.categories = { hasSome: [category] };
    }
    
    // Build orderBy
    let orderBy: Prisma.BookOrderByWithRelationInput = {};
    switch (sort) {
      case 'popular':
        orderBy = { events: { _count: 'desc' } };
        break;
      case 'new':
        orderBy = { createdAt: 'desc' };
        break;
      case 'rating':
        orderBy = { ratings: { _count: 'desc' } };
        break;
    }
    
    // Execute query
    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: { select: { id: true, name: true } },
          _count: { select: { ratings: true } }
        }
      }),
      prisma.book.count({ where })
    ]);
    
    // Enhance with signed URLs
    const booksWithUrls = books.map(book => ({
      ...book,
      coverUrl: book.coverKey ? getSignedUrl(book.coverKey) : null
    }));
    
    const result = {
      total,
      page,
      limit,
      items: booksWithUrls
    };
    
    // Cache result
    await redis.set(cacheKey, JSON.stringify(result), CACHE_TTL);
    
    return result;
  }

  async getBookById(id: string): Promise<Book> {
    // Check cache
    const cached = await redis.get(`book:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const book = await prisma.book.findUnique({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { ratings: true } },
        ratings: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true } }
        }
      }
    });
    
    if (!book) {
      throw new HttpException('Book not found', 404);
    }
    
    // Add signed URLs
    const bookWithUrls = {
      ...book,
      fileUrl: getSignedUrl(book.fileKey),
      coverUrl: book.coverKey ? getSignedUrl(book.coverKey) : null
    };
    
    // Cache result
    await redis.set(`book:${id}`, JSON.stringify(bookWithUrls), CACHE_TTL);
    
    return bookWithUrls;
  }

  async updateBook(id: string, userId: string, data: Partial<Prisma.BookUpdateInput>) {
    // Verify ownership
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book || book.userId !== userId) {
      throw new HttpException('Book not found or access denied', 404);
    }
    
    // Invalidate cache
    await redis.del(`book:${id}`);
    await redis.del('books:*');
    
    return prisma.book.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteBook(id: string, userId: string) {
    // Verify ownership
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book || book.userId !== userId) {
      throw new HttpException('Book not found or access denied', 404);
    }
    
    // Soft delete
    await prisma.book.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    
    // Invalidate cache
    await redis.del(`book:${id}`);
    await redis.del('books:*');
  }

  private async validateFileOwnership(userId: string, fileKey: string) {
    // In a real app, verify user owns the file in storage
    // For simplicity, we just check the pattern
    if (!fileKey.includes(`/user_${userId}/`)) {
      logger.warn(`User ${userId} attempted to access unauthorized file: ${fileKey}`);
      throw new HttpException('File access denied', 403);
    }
  }
}

export default new BookService();