import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        roles: string[];
      };
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      JWT_SECRET: string;
      JWT_EXPIRES_IN: string;
      REFRESH_TOKEN_EXPIRY: string;
      DATABASE_URL: string;
      UPSTASH_REDIS_REST_URL: string;
      UPSTASH_REDIS_REST_TOKEN: string;
      SUPABASE_URL: string;
      SUPABASE_KEY: string;
      SUPABASE_BUCKET: string;
      RECS_SERVICE_URL: string;
      RECS_SERVICE_API_KEY: string;
      EVENTS_STREAM: string;
    }
  }
}

// Extend Prisma types if needed
declare module '@prisma/client' {
  interface Book {
    coverUrl?: string | null;
    fileUrl?: string;
  }
}

export {};