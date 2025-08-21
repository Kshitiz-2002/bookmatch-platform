import buildApp from './app';
import { prisma } from './lib/db';
import dotenv from 'dotenv';

dotenv.config();

const app = buildApp();
const port = Number(process.env.PORT || 4000);

const start = async () => {
  try {
    // test DB connection at startup (optional, helpful)
    await prisma.$connect();
    app.log.info('Prisma connected to DB');
  } catch (e: unknown) {
    app.log.error('Prisma failed to connect at startup:', e as any);
  }

  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
