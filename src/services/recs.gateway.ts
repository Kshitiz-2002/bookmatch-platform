import axios from 'axios';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { config } from '../config/config';
import { HttpException } from '../errors/HttpException';

const CACHE_TTL = 1800; // 30 minutes

class RecsGateway {
  private client = axios.create({
    baseURL: config.RECS_SERVICE_URL,
    timeout: 5000,
    headers: { 'X-API-KEY': config.RECS_SERVICE_API_KEY }
  });

  async getUserRecommendations(userId: string, limit: number = 20) {
    const cacheKey = `recs:user:${userId}:${limit}`;
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    try {
      const response = await this.client.get(`/user/${userId}/top?n=${limit}`);
      const recommendations = response.data.items;
      
      // Cache result
      await redis.set(cacheKey, JSON.stringify(recommendations), CACHE_TTL);
      
      return recommendations;
    } catch (err) {
      logger.error('Recommendation service failed', err);
      
      // Fallback to popular books
      return this.getFallbackRecommendations(limit);
    }
  }

  async getSimilarBooks(bookId: string, limit: number = 10) {
    const cacheKey = `recs:book:${bookId}:${limit}`;
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    try {
      const response = await this.client.get(`/book/${bookId}/similar?n=${limit}`);
      const similarBooks = response.data.items;
      
      // Cache result
      await redis.set(cacheKey, JSON.stringify(similarBooks), CACHE_TTL);
      
      return similarBooks;
    } catch (err) {
      logger.error('Recommendation service failed', err);
      
      // Fallback to popular books
      return this.getFallbackRecommendations(limit);
    }
  }

  async triggerTraining(full: boolean = false) {
    try {
      const response = await this.client.post('/train', { full });
      return response.data.jobId;
    } catch (err) {
      logger.error('Training trigger failed', err);
      throw new HttpException('Failed to trigger training', 500);
    }
  }

  private async getFallbackRecommendations(limit: number) {
    const cacheKey = `recs:fallback:${limit}`;
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Get popular books from database
    const popularBooks = await prisma.book.findMany({
      where: { 
        deletedAt: null,
        visibility: 'PUBLIC'
      },
      take: limit,
      orderBy: { ratings: { _count: 'desc' } },
      select: { id: true }
    });
    
    const recommendations = popularBooks.map(book => ({
      bookId: book.id,
      score: 0.8, // Default score for fallback
      reason: 'Popular books fallback'
    }));
    
    // Cache fallback
    await redis.set(cacheKey, JSON.stringify(recommendations), 3600); // 1 hour
    
    return recommendations;
  }
}

export default new RecsGateway();