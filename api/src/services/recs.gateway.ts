import axios from "axios";
import redis from "../lib/redis";

const RECS_BASE = process.env.RECS_SERVICE_URL || "http://localhost:8001";
const USER_RECS_TTL_SECONDS = 60 * 30; // 30 minutes
const USER_RECS_KEYS_SET_PREFIX = "user:recs:keys:";

/**
 * Rec item type
 */
export type RecItem = { bookId: string; score: number; reason?: string };

/**
 * Cache user recs and register key in a set for easy invalidation.
 */
export async function getUserRecommendations(userId: string, n = 20): Promise<RecItem[]> {
  const cacheKey = `user:recs:${userId}:n:${n}`;

  // 1) try cached
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.warn("redis.get failed", err);
  }

  // 2) fetch from recs-service
  const url = `${RECS_BASE}/api/v1/recs/user/${encodeURIComponent(userId)}/top?n=${n}`;
  const resp = await axios.get(url, { timeout: 5000 });
  const items: RecItem[] = resp.data || [];

  // 3) cache result and register key for invalidation
  try {
    await redis.set(cacheKey, JSON.stringify(items), { ex: USER_RECS_TTL_SECONDS } as any);
    const keysSet = `${USER_RECS_KEYS_SET_PREFIX}${userId}`;
    // keep a set of keys to invalidate later
    await redis.sadd(keysSet, cacheKey);
    await redis.expire(keysSet, USER_RECS_TTL_SECONDS + 60); // expire slightly after entries
  } catch (err) {
    console.warn("redis.set or sadd failed", err);
  }

  return items;
}

/**
 * Get book-similar (cached)
 */
export async function getSimilarBooks(bookId: string, n = 10): Promise<RecItem[]> {
  const cacheKey = `book:similar:${bookId}:n:${n}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.warn("redis.get failed", err);
  }

  const url = `${RECS_BASE}/api/v1/recs/book/${encodeURIComponent(bookId)}/similar?n=${n}`;
  const resp = await axios.get(url, { timeout: 5000 });
  const items: RecItem[] = resp.data || [];

  try {
    await redis.set(cacheKey, JSON.stringify(items), { ex: 60 * 60 } as any); // 1h
  } catch (err) {
    console.warn("redis.set failed", err);
  }

  return items;
}

/**
 * Invalidate user rec caches (called e.g., after rating or read)
 * It reads the set of cache keys we tracked for that user and deletes them.
 */
export async function invalidateUserRecs(userId: string) {
  const keysSet = `${USER_RECS_KEYS_SET_PREFIX}${userId}`;
  try {
    const members: string[] = (await redis.smembers(keysSet)) || [];
    if (members.length > 0) {
      await redis.del(...members);
    }
    // remove the set
    await redis.del(keysSet);
  } catch (err) {
    console.warn("invalidateUserRecs failed", err);
  }
}
