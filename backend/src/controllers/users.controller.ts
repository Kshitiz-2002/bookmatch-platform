import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { hashPassword } from '../lib/hash';

const updateSchema = z.object({
  name: z.string().optional(),
  password: z.string().min(6).optional()
});

export async function updateMeHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    // request.user populated by jwtVerify in preHandler
    const payload: any = (req as any).user;
    const userId = payload?.userId;
    if (!userId) return reply.code(401).send({ error: 'Invalid token payload' });

    const parsed = updateSchema.parse(req.body);
    const data: any = {};
    if (parsed.name) data.name = parsed.name;
    if (parsed.password) data.password = await hashPassword(parsed.password);

    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data,
      select: { id: true, email: true, name: true, createdAt: true }
    });

    return reply.send({ user });
  } catch (err: any) {
    return reply.code(400).send({ error: 'Invalid payload', details: err.errors ?? err.message });
  }
}

export async function deleteMeHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const payload: any = (req as any).user;
    const userId = payload?.userId;
    if (!userId) return reply.code(401).send({ error: 'Invalid token payload' });

    // delete refresh tokens first
    await prisma.refreshToken.deleteMany({ where: { userId: Number(userId) }});
    // delete user (cascade will fail if there are FK constraints without cascade — ensure your DB tables allow safe deletion or delete related rows first)
    await prisma.user.delete({ where: { id: Number(userId) }});
    return reply.send({ ok: true });
  } catch (err: any) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Failed to delete account' });
  }
}

export async function addToLibraryHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    await (req as any).jwtVerify();
  } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
  const payload: any = (req as any).user;
  const userId = Number(payload.userId);
  const { bookId, status } = req.body as any;
  if (!bookId) return reply.code(400).send({ error: 'bookId required' });
  const entry = await prisma.userBook.create({ data: { userId, bookId: Number(bookId), status: status || 'want-to-read' }});
  return reply.send({ entry });
}

export async function listLibraryHandler(req: FastifyRequest, reply: FastifyReply) {
  try { await (req as any).jwtVerify(); } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
  const payload: any = (req as any).user;
  const userId = Number(payload.userId);
  const items = await prisma.userBook.findMany({ where: { userId }, include: { book: { include: { genres: { include: { genre: true } }, ratings: true } } }, orderBy: { createdAt: 'desc' }});
  return reply.send({ items });
}

export async function removeFromLibraryHandler(req: FastifyRequest, reply: FastifyReply) {
  try { await (req as any).jwtVerify(); } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
  const payload: any = (req as any).user;
  const userId = Number(payload.userId);
  const bookId = Number((req.params as any).bookId);
  await prisma.userBook.deleteMany({ where: { userId, bookId }});
  return reply.send({ ok: true });
}