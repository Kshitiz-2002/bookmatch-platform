import Redis from 'ioredis';
import { logger } from './logger';
import { config } from '../config/config';

class RedisClient {
  private client: Redis;
  private static instance: RedisClient;

  private constructor() {
    this.client = new Redis(config.UPSTASH_REDIS_REST_URL, {
      tls: {
        rejectUnauthorized: false
      },
      password: config.UPSTASH_REDIS_REST_TOKEN,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000)
    });

    this.client.on('connect', () => logger.info('Redis connected'));
    this.client.on('error', (err) => logger.error('Redis error', err));
    this.client.on('reconnecting', () => logger.warn('Redis reconnecting'));
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    if (this.client.status !== 'ready') {
      await this.client.connect();
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err) {
      logger.error('Redis GET failed', { key, error: err });
      throw new Error('Cache operation failed');
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      logger.error('Redis SET failed', { key, error: err });
      throw new Error('Cache operation failed');
    }
  }

  public async del(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length) await this.client.del(...keys);
    } catch (err) {
      logger.error('Redis DEL failed', { pattern, error: err });
      throw new Error('Cache invalidation failed');
    }
  }

  public async xadd(stream: string, data: Record<string, string>): Promise<void> {
    try {
      const args = Object.entries(data).flatMap(([key, value]) => [key, value]);
      await this.client.xadd(stream, '*', ...args);
    } catch (err) {
      logger.error('Redis XADD failed', { stream, error: err });
      throw new Error('Event streaming failed');
    }
  }

  public async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export const redis = RedisClient.getInstance();