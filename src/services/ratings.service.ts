import prisma from '../lib/prisma';
import { redis } from '../lib/redis';
import { HttpException } from '../errors/HttpException';
import { analyticsService } from './analytics.service';

class RatingService {
  async rateBook(bookId: string, userId: string, rating: number) {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new HttpException('Rating must be between 1 and 5', 400);
    }
    
    // Upsert rating
    const result = await prisma.$transaction(async (tx) => {
      // Upsert the rating
      const ratingRecord = await tx.rating.upsert({
        where: { userId_bookId: { userId, bookId } },
        update: { rating },
        create: { userId, bookId, rating }
      });
      
      // Recalculate average rating
      const aggregate = await tx.rating.aggregate({
        where: { bookId },
        _avg: { rating: true },
        _count: true
      });
      
      // Update book
      await tx.book.update({
        where: { id: bookId },
        data: {
          avgRating: aggregate._avg.rating,
          ratingCount: aggregate._count
        }
      });
      
      return ratingRecord;
    });
    
    // Invalidate caches
    await redis.del(`book:${bookId}`);
    await redis.del(`user:${userId}:ratings`);
    await redis.del('books:*');
    
    // Record analytics event
    await analyticsService.recordEvent({
      userId,
      bookId,
      event: 'rating',
      meta: { rating }
    });
    
    // Trigger recommendation update
    await analyticsService.refreshRecommendations(userId);
    
    return result;
  }

  async getBookRatings(bookId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    return prisma.rating.findMany({
      where: { bookId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } }
      }
    });
  }

  async createReview(bookId: string, userId: string, content: string, isSpoiler: boolean = false) {
    // Ensure user has rated the book
    const rating = await prisma.rating.findUnique({
      where: { userId_bookId: { userId, bookId } }
    });
    
    if (!rating) {
      throw new HttpException('You must rate the book before reviewing', 400);
    }
    
    // Update with review
    return prisma.rating.update({
      where: { id: rating.id },
      data: {
        content,
        isSpoiler
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });
  }
}

export default new RatingService();