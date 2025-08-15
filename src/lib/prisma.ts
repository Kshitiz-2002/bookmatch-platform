import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { config } from '../config/config';

const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'info', emit: 'event' },
    { level: 'query', emit: 'event' }
  ],
  datasources: {
    db: {
      url: config.DATABASE_URL
    }
  }
});

// Logging configuration
prisma.$on('warn', (e) => logger.warn(e.message));
prisma.$on('info', (e) => logger.info(e.message));
prisma.$on('error', (e) => logger.error(e.message));

if (config.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug(`Query: ${e.query}`);
    logger.debug(`Params: ${e.params}`);
    logger.debug(`Duration: ${e.duration}ms`);
  });
}

// Connection middleware
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  
  logger.debug(`Query ${params.model}.${params.action} took ${after - before}ms`);
  
  return result;
});

// Soft delete middleware
prisma.$use(async (params, next) => {
  if (params.model === 'Book') {
    if (params.action === 'delete') {
      params.action = 'update';
      params.args.data = { deletedAt: new Date() };
    }
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args.data !== undefined) {
        params.args.data.deletedAt = new Date();
      } else {
        params.args.data = { deletedAt: new Date() };
      }
    }
  }
  return next(params);
});

export default prisma;