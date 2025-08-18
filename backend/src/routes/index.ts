import { FastifyInstance } from 'fastify';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import { prisma } from '../lib/db';
import { getRecsHandler, postRecsHandler } from '../controllers/recs.controller';
import booksRoutes from './books.routes';
import adminRoutes from './admin.routes';

export default async function routes(app: FastifyInstance) {
   app.get('/health', async () => ({ status: 'ok' }));
  app.get('/dbtest', async () => { const r: any = await prisma.$queryRaw`SELECT 1 as result`; return { ok: true, result: r[0]?.result ?? null }; });

  app.register(authRoutes);
  app.register(usersRoutes);
  app.register(booksRoutes);
  // recs
  app.get('/recs', getRecsHandler);
  app.post('/recs', postRecsHandler);
  // admin
  app.register(adminRoutes);
}