import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db';

type Req = FastifyRequest & { user?: any };

export async function addToLibraryHandler(req: Req, reply: FastifyReply) {
  try {
    await (req as any).jwtVerify();
  } catch (e) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const payload: any = (req as any).user;
  const userId = Number(payload.userId);
  const body: any = req.body || {};
  const bookId = Number(body.bookId);
  const status = body.status || 'want-to-read';

  if (!bookId) return reply.code(400).send({ error: 'bookId required' });

  // optional: verify book exists
  const book = await prisma.book.findUnique({ where: { id: bookId }});
  if (!book) return reply.code(404).send({ error: 'Book not found' });

  // Upsert: if user already has an entry for this book, update status
  const existing = await prisma.userBook.findFirst({ where: { userId, bookId } });
  if (existing) {
    const updated = await prisma.userBook.update({
      where: { id: existing.id },
      data: { status }
    });
    return reply.send({ entry: updated });
  }

  const entry = await prisma.userBook.create({
    data: { userId, bookId, status }
  });

  return reply.send({ entry });
}

export async function listLibraryHandler(req: Req, reply: FastifyReply) {
  try {
    await (req as any).jwtVerify();
  } catch (e) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const payload: any = (req as any).user;
  const userId = Number(payload.userId);

  const items = await prisma.userBook.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      book: {
        include: {
          genres: { include: { genre: true } },
          ratings: true
        }
      }
    }
  });

  // normalize genres to string array and compute avgRating
  const out = items.map(it => {
    const b: any = it.book;
    const genres = (b.genres || []).map((bg: any) => bg.genre.name);
    const avgRating = b.ratings && b.ratings.length ? (b.ratings.reduce((s: number, r: any) => s + r.score, 0) / b.ratings.length) : null;
    return {
      id: it.id,
      status: it.status,
      createdAt: it.createdAt,
      book: {
        id: b.id,
        title: b.title,
        author: b.author,
        isPublic: b.isPublic,
        genres,
        avgRating,
        filePath: b.filePath,
        coverPath: b.coverPath
      }
    };
  });

  return reply.send({ items: out });
}

export async function removeFromLibraryHandler(req: Req, reply: FastifyReply) {
  try {
    await (req as any).jwtVerify();
  } catch (e) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const payload: any = (req as any).user;
  const userId = Number(payload.userId);
  const bookId = Number((req.params as any).bookId);

  if (!bookId) return reply.code(400).send({ error: 'bookId required' });

  await prisma.userBook.deleteMany({ where: { userId, bookId }});
  return reply.send({ ok: true });
}

export async function updateLibraryHandler(req: Req, reply: FastifyReply) {
  try {
    await (req as any).jwtVerify();
  } catch (e) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const payload: any = (req as any).user;
  const userId = Number(payload.userId);
  const bookId = Number((req.params as any).bookId);
  const body: any = req.body || {};
  const status = (body.status || '').toString().trim();

  if (!bookId) return reply.code(400).send({ error: 'bookId required in URL' });

  // Validate allowed statuses (customize if you want more)
  const allowed = new Set(['want-to-read', 'reading', 'read', 'paused']);
  if (!status || !allowed.has(status)) {
    return reply.code(400).send({ error: 'Invalid status. Allowed: want-to-read, reading, read, paused' });
  }

  // verify book exists
  const book = await prisma.book.findUnique({ where: { id: bookId }});
  if (!book) return reply.code(404).send({ error: 'Book not found' });

  // find existing entry
  const existing = await prisma.userBook.findFirst({ where: { userId, bookId } });

  if (existing) {
    const updated = await prisma.userBook.update({
      where: { id: existing.id },
      data: { status }
    });
    return reply.send({ entry: updated });
  } else {
    const entry = await prisma.userBook.create({
      data: { userId, bookId, status }
    });
    return reply.send({ entry });
  }
}