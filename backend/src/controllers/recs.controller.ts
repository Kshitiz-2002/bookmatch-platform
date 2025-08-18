import { FastifyRequest, FastifyReply } from 'fastify';
import { recommendForUser } from '../services/recs.service';

export async function getRecsHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    await (req as any).jwtVerify();
  } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
  const payload: any = (req as any).user;
  const userId = Number(payload.userId);
  const limit = Math.min(Number((req.query as any)?.limit ?? 10), 100);
  const seedBooksParam = (req.query as any)?.seedBooks || '';
  const seedBooks = seedBooksParam ? seedBooksParam.split(',').map((s:string)=>Number(s)).filter(Boolean) : [];
  const publicOnly = ((req.query as any)?.publicOnly ?? 'true') === 'true';
  const items = await recommendForUser(userId, limit, seedBooks, publicOnly);
  return reply.send({ items });
}

export async function postRecsHandler(req: FastifyRequest, reply: FastifyReply) {
  try { await (req as any).jwtVerify(); } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
  const payload: any = (req as any).user;
  const userId = Number(payload.userId);
  const body: any = req.body || {};
  const limit = Math.min(Number(body.limit ?? 10), 100);
  const seedBooks = Array.isArray(body.seedBooks) ? body.seedBooks.map(Number) : [];
  // for now we ignore `examples` and `strategy` for simplicity, but they can be passed to LLM re-rank step later
  const items = await recommendForUser(userId, limit, seedBooks, true);
  return reply.send({ items });
}
