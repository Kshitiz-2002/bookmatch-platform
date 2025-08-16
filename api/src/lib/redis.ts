import { Redis as UpstashRedis } from "@upstash/redis";

let redisClient: any = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Upstash REST client (serverless-friendly)
  redisClient = new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log("Using Upstash REST Redis client");
} else {
  // Fallback: ioredis (for local/docker usage)
  const IORedis = require("ioredis");
  redisClient = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
  redisClient.on("connect", () => console.log("ioredis connected"));
  redisClient.on("error", (err: any) => console.error("ioredis error", err));
  console.log("Using ioredis client");
}

export default redisClient;
export const redis = redisClient;