import app from './app';
import { prisma } from './lib/prisma';
import { redisService } from './services/redis.service';
import logger from './lib/logger';
import { config } from './config/config';

const PORT = config.PORT;

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');
    
    // Test Redis connection
    await redisService.ping();
    logger.info('Redis connected');
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received: shutting down gracefully');
  await prisma.$disconnect();
  await redisService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received: shutting down gracefully');
  await prisma.$disconnect();
  await redisService.disconnect();
  process.exit(0);
});

startServer();