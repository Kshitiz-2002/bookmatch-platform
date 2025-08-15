import { redis } from '../lib/redis';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import recsGateway from "./recs.gateway"

class AnalyticsService {
  async recordEvent(eventData: {
    userId?: string;
    bookId: string;
    event: 'impression' | 'click' | 'open' | 'download' | 'rating';
    meta?: Record<string, any>;
  }) {
    try {
      // Add to Redis stream for real-time processing
      await redis.xadd(config.EVENTS_STREAM, {
        userId: eventData.userId || 'anonymous',
        bookId: eventData.bookId,
        event: eventData.event,
        meta: JSON.stringify(eventData.meta || {}),
        timestamp: Date.now().toString()
      });
      
      // Store in database
      await prisma.event.create({
        data: {
          type: eventData.event,
          userId: eventData.userId,
          bookId: eventData.bookId,
          meta: eventData.meta
        }
      });
    } catch (err) {
      logger.error('Failed to record event', eventData, err);
    }
  }

  async refreshRecommendations(userId: string) {
    try {
      // Invalidate user recommendations cache
      await redis.del(`recs:user:${userId}:*`);
      
      // Trigger incremental update
      await recsGateway.triggerTraining(false);
    } catch (err) {
      logger.error('Failed to refresh recommendations', { userId }, err);
    }
  }

  async calculateCTR() {
    // This would be implemented with actual analytics logic
    try {
      const impressions = await prisma.event.count({ 
        where: { type: 'impression' } 
      });
      
      const clicks = await prisma.event.count({ 
        where: { type: 'click' } 
      });
      
      return impressions > 0 ? clicks / impressions : 0;
    } catch (err) {
      logger.error('CTR calculation failed', err);
      return 0;
    }
  }
}

export default new AnalyticsService();