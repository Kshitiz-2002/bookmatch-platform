import { FastifyInstance } from 'fastify';
import { computeEmbeddingsHandler } from '../controllers/admin.controller';

export default async function adminRoutes(app: FastifyInstance) {
  app.post('/admin/compute-embeddings', { preHandler: [ async (r, rp) => { try { await (r as any).jwtVerify(); } catch { rp.code(401).send({ error: 'Unauthorized'}); } }] }, computeEmbeddingsHandler);

}
