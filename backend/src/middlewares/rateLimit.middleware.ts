import { FastifyReply, FastifyRequest } from 'fastify';

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter.
 * `max` requests per `windowMs` milliseconds per IP.
 * Not suitable across multiple processes — only for dev/prototype.
 */
export function rateLimit({ max = 100, windowMs = 60_000 } = {}) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ip = (req as any).ip || (req as any).raw?.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = store.get(ip) ?? { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    store.set(ip, bucket);

    reply.header('X-RateLimit-Limit', String(max));
    reply.header('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    reply.header('X-RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > max) {
      return reply.code(429).send({ error: 'Too Many Requests' });
    }
  };
}
