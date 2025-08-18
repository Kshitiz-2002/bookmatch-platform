import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db';
import { getEmbeddingIfConfigured } from '../services/embeddings.service';

export async function computeEmbeddingsHandler(req: FastifyRequest, reply: FastifyReply) {
  // require admin
  try { await (req as any).jwtVerify(); } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
  const payload: any = (req as any).user;
  const user = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
  if (!user || user.role !== 'ADMIN') return reply.code(403).send({ error: 'Forbidden' });

  const body: any = req.body || {};
  const bookIds = Array.isArray(body.bookIds) ? body.bookIds.map(Number) : null;

  // find books that need embeddings
  const books = await prisma.book.findMany({
    where: bookIds ? { id: { in: bookIds } } : {},
    include: { embedding: true }
  });

  const toProcess = books.filter(b => !b.embedding);
  const processed = [];
  const failed: any[] = [];

  for (const b of toProcess) {
    try {
      const text = b.description ?? b.title ?? '';
      const emb = await getEmbeddingIfConfigured(text);
      if (emb && emb.length) {
        await prisma.embedding.create({ data: { vector: emb, bookId: b.id }});
        processed.push(b.id);
      } else {
        failed.push({ bookId: b.id, reason: 'no_embedding_available'});
      }
    } catch (e) {
      failed.push({ bookId: b.id, reason: String(e) });
    }
  }

  return reply.send({ processed: processed.length, failed });
}
