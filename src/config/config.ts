import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  DATABASE_URL: z.string().url(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string(),
  SUPABASE_BUCKET: z.string().default('books'),
  RECS_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  EVENTS_STREAM: z.string().default('book_events'),
});

export const config = configSchema.parse(process.env);
export type Config = z.infer<typeof configSchema>;