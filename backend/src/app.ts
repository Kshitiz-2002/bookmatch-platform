// backend/src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from 'fastify-jwt';
import fastifyMultipart from 'fastify-multipart';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import errorPlugin from './middlewares/error.middleware';
import authPlugin from './middlewares/auth.middleware';
import routes from './routes/index';

dotenv.config();

/**
 * buildApp - create & configure Fastify instance
 */
export default function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  // read allowed origins from env (comma separated). Example:
  // ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
  const allowedOriginsEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Register CORS BEFORE routes & other plugins that rely on preHandlers
  app.register(cors, {
    origin: (origin, cb) => {
      // allow non-browser clients (curl, Postman) - they have no origin
      if (!origin) return cb(null, true);

      // if explicit env list contains the origin, allow it
      if (allowedOriginsEnv.length && allowedOriginsEnv.includes(origin)) {
        return cb(null, true);
      }

      // allow common localhost / loopback dev servers
      try {
        const u = new URL(origin);
        const host = u.hostname;
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
          return cb(null, true);
        }
      } catch {
        // ignore parse errors and fallthrough
      }

      // in development allow any origin to reduce friction (change in production)
      if ((process.env.NODE_ENV || 'development').toLowerCase() !== 'production') {
        return cb(null, true);
      }

      // otherwise reject
      return cb(new Error('Not allowed by CORS'), false);
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // credentials: true, // enable only if you use cookies/sessions; with JWT this is usually false
  });

  // JWT plugin (register before auth middleware so req.jwtVerify() is available)
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'dev',
    sign: { expiresIn: process.env.ACCESS_TOKEN_TTL || '7d' },
  });

  // multipart MUST be registered before routes (handlers will use it)
  app.register(fastifyMultipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  });

  // global plugins / middlewares
  app.register(errorPlugin);
  app.register(authPlugin);

  // application routes
  app.register(routes);

  return app;
}
