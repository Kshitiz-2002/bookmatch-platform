import Fastify from 'fastify';
import fastifyJwt from 'fastify-jwt';
import fastifyMultipart from 'fastify-multipart';
import dotenv from 'dotenv';
import errorPlugin from './middlewares/error.middleware';
import authPlugin from './middlewares/auth.middleware';
import routes from './routes/index';

dotenv.config();

export default function buildApp() {
  const app = Fastify({ logger: true });

  // 1) JWT plugin
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'dev',
    sign: { expiresIn: '7d' }
  });

  // 2) multipart MUST be registered before routes
  // fastify-multipart for Fastify v4
  app.register(fastifyMultipart, {
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
    // you can add other options here
  });

  // 3) global plugins
  app.register(errorPlugin);
  app.register(authPlugin);

  // 4) routes (use multipart functionality inside handlers)
  app.register(routes);

  return app;
}
