import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { getEmbeddingIfConfigured } from '../services/embeddings.service'; // optional
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { prisma as _prisma } from '../lib/db';

// Schemas
const createSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  isPublic: z.boolean().optional(),
  genres: z.array(z.string()).optional(), // array of genre names
  metadata: z.any().optional()
});

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  isPublic: z.boolean().optional(),
  genres: z.array(z.string()).optional(),
  metadata: z.any().optional()
});

const rateSchema = z.object({
  score: z.number().min(1).max(5),
  review: z.string().optional()
});

// helpers
async function upsertGenres(names: string[]) {
  const genres = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const g = await prisma.genre.upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed }
    });
    genres.push(g);
  }
  return genres;
}

// Handlers
export async function downloadBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const id = Number((req.params as any).id);
  if (!id) return reply.code(400).send({ error: 'Invalid book id' });

  // fetch book
  const book = await prisma.book.findUnique({ where: { id }});
  if (!book) return reply.code(404).send({ error: 'Book not found' });
  if (!book.filePath) return reply.code(404).send({ error: 'No file recorded for this book' });

  // permission: if private, check owner/admin
  if (!book.isPublic) {
    try {
      await (req as any).jwtVerify();
    } catch (e) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const payload: any = (req as any).user;
    const user = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
    const isOwner = user && user.id === book.uploadedById;
    const isAdmin = user && user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return reply.code(403).send({ error: 'Forbidden' });
  }

  // Resolve safe file path. Use relative to project if stored that way.
  const filePath = path.isAbsolute(book.filePath) ? book.filePath : path.join(process.cwd(), book.filePath);

  // Validate file presence
  if (!fs.existsSync(filePath)) {
    req.log.warn(`Download requested but file missing: ${filePath}`);
    return reply.code(404).send({ error: 'File missing on server' });
  }

  // stream file
  try {
    const stat = await fs.promises.stat(filePath);
    const filename = path.basename(filePath);
    const mimeType = mime.lookup(filename) || 'application/octet-stream';

    reply.header('Content-Type', mimeType);
    reply.header('Content-Length', String(stat.size));
    // use attachment so browsers download it
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    const stream = fs.createReadStream(filePath);
    return reply.send(stream);
  } catch (err: any) {
    req.log.error('Failed streaming file', err);
    return reply.code(500).send({ error: 'Failed to stream file' });
  }
}

export async function createBookHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!(req as any).isMultipart || !(req as any).isMultipart()) {
    return reply.code(415).send({ error: 'Expected multipart/form-data' });
  }

  // verify JWT and load user
  try {
    await (req as any).jwtVerify();
  } catch (e) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const payload: any = (req as any).user;
  if (!payload?.userId) return reply.code(401).send({ error: 'Invalid token payload' });
  const uploader = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
  if (!uploader) return reply.code(401).send({ error: 'Uploader not found' });

  const parts = (req as any).parts();
  const fields: Record<string, any> = {};
  let savedFilePath: string | null = null;

  try {
    for await (const part of parts) {
      if (part.file) {
        // store file
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const filename = `${Date.now()}_${uuidv4()}_${part.filename}`;
        const filepath = path.join(uploadDir, filename);
        const ws = fs.createWriteStream(filepath);
        await new Promise<void>((resolve, reject) => {
          part.file.pipe(ws);
          part.file.on('error', (err: any) => reject(err));
          ws.on('error', (err) => reject(err));
          ws.on('finish', () => resolve());
        });
        savedFilePath = filepath;
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    const title = fields.title;
    if (!title) return reply.code(400).send({ error: 'title is required' });
    const description = fields.description ?? null;
    const author = fields.author ?? null;
    const isPublic = fields.isPublic === 'false' ? false : Boolean(fields.isPublic ?? true);

    const created = await prisma.book.create({
      data: {
        title,
        description,
        author,
        filePath: savedFilePath ?? '',
        isPublic,
        uploadedById: uploader.id,
        metadata: fields.metadata ? JSON.parse(fields.metadata) : {}
      }
    });

    // genres (if any)
    if (fields.genres) {
      let genres: string[] = [];
      try {
        const parsed = JSON.parse(fields.genres);
        if (Array.isArray(parsed)) genres = parsed.map((s: any) => String(s).trim()).filter(Boolean);
      } catch {
        genres = String(fields.genres).split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      for (const gname of genres) {
        const g = await prisma.genre.upsert({ where: { name: gname }, update: {}, create: { name: gname }});
        await prisma.bookGenre.create({ data: { bookId: created.id, genreId: g.id }});
      }
    }

    // optional embedding
    try {
      const textToEmbed = description ?? title ?? '';
      const emb = await getEmbeddingIfConfigured(textToEmbed);
      if (emb && emb.length) {
        await prisma.embedding.create({ data: { vector: emb, bookId: created.id }});
      }
    } catch (e: unknown) {
      req.log.warn('embedding failed', e as any);
    }

    return reply.code(201).send({ book: created });
  } catch (err: any) {
    req.log.error(err);
    // cleanup saved file if DB insert failed
    try { if (savedFilePath && fs.existsSync(savedFilePath)) fs.unlinkSync(savedFilePath); } catch(e){}
    return reply.code(500).send({ error: 'Upload failed', details: err?.message });
  }
}

export async function getBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const id = Number((req.params as any).id);
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      genres: { include: { genre: true } },
      ratings: true,
      embedding: true,
      uploadedBy: { select: { id: true, email: true, name: true }}
    }
  });
  if (!book) return reply.code(404).send({ error: 'Not found' });

  if (!book.isPublic) {
    // ensure requester is owner or admin
    try {
      await (req as any).jwtVerify();
      const payload: any = (req as any).user;
      const user = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
      const isOwner = user && user.id === book.uploadedById;
      const isAdmin = user && user.role === 'ADMIN';
      if (!isOwner && !isAdmin) return reply.code(403).send({ error: 'Forbidden' });
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  }

  // map genres
  const gnames = (book.genres || []).map(bg => bg.genre.name);
  const avgRating = book.ratings.length ? (book.ratings.reduce((s, r) => s + r.score, 0) / book.ratings.length) : null;

  return reply.send({ book: { ...book, genres: gnames, avgRating }});
}

export async function listBooksHandler(req: FastifyRequest, reply: FastifyReply) {
  const q = (req.query as any)?.q;
  const genre = (req.query as any)?.genre;
  const publicOnly = ((req.query as any)?.publicOnly ?? 'true') === 'true';
  const limit = Math.min(Number((req.query as any)?.limit ?? 20), 100);
  const offset = Number((req.query as any)?.offset ?? 0);

  const where: any = {};
  if (publicOnly) where.isPublic = true;

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { author: { contains: q, mode: 'insensitive' } }
    ];
  }

  // if filtering by genre, join via BookGenre
  if (genre) {
    const booksWithGenre = await prisma.bookGenre.findMany({
      where: { genre: { name: genre } },
      select: { bookId: true }
    });
    const ids = booksWithGenre.map(x => x.bookId);
    where.id = { in: ids.length ? ids : [-1] };
  }

  const books = await prisma.book.findMany({
    where,
    include: { genres: { include: { genre: true } }, ratings: true, uploadedBy: { select: { id: true, email: true, name: true }}},
    skip: offset,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });

  const out = books.map(b => ({
    id: b.id, title: b.title, author: b.author, createdAt: b.createdAt, isPublic: b.isPublic,
    genres: b.genres.map(g => g.genre.name),
    avgRating: b.ratings.length ? (b.ratings.reduce((s, r) => s + r.score, 0) / b.ratings.length) : null,
    uploadedBy: b.uploadedBy
  }));

  return reply.send({ items: out });
}

export async function updateBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const id = Number((req.params as any).id);
  const parsed = updateSchema.parse(req.body || {});
  const book = await prisma.book.findUnique({ where: { id }});
  if (!book) return reply.code(404).send({ error: 'Not found' });

  // authorize: owner or admin
  try {
    await (req as any).jwtVerify();
    const payload: any = (req as any).user;
    const user = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
    const isOwner = user && user.id === book.uploadedById;
    const isAdmin = user && user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return reply.code(403).send({ error: 'Forbidden' });
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const data: any = {};
  if (parsed.title) data.title = parsed.title;
  if (parsed.description) data.description = parsed.description;
  if (parsed.author) data.author = parsed.author;
  if (typeof parsed.isPublic === 'boolean') data.isPublic = parsed.isPublic;
  if (parsed.metadata) data.metadata = parsed.metadata;

  const updated = await prisma.book.update({ where: { id }, data, include: { genres: { include: { genre: true } } }});

  // update genres if provided
  if (parsed.genres) {
    // remove existing relations
    await prisma.bookGenre.deleteMany({ where: { bookId: id }});
    const gList = await upsertGenres(parsed.genres);
    for (const g of gList) {
      await prisma.bookGenre.create({ data: { bookId: id, genreId: g.id }});
    }
  }

  return reply.send({ book: updated });
}

export async function deleteBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const id = Number((req.params as any).id);
  const book = await prisma.book.findUnique({ where: { id }});
  if (!book) return reply.code(404).send({ error: 'Not found' });

  // authorize
  try {
    await (req as any).jwtVerify();
    const payload: any = (req as any).user;
    const user = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
    const isOwner = user && user.id === book.uploadedById;
    const isAdmin = user && user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return reply.code(403).send({ error: 'Forbidden' });
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  // delete dependent records then file
  await prisma.bookGenre.deleteMany({ where: { bookId: id }});
  await prisma.rating.deleteMany({ where: { bookId: id }});
  await prisma.embedding.deleteMany({ where: { bookId: id }});
  await prisma.userBook.deleteMany({ where: { bookId: id }});
  await prisma.book.delete({ where: { id }});

  // remove file if exists
  try {
    if (book.filePath && fs.existsSync(book.filePath)) {
      fs.unlinkSync(book.filePath);
    }
  } catch (e: unknown) {
    req.log.warn('file delete failed', e as any);
  }

  return reply.send({ ok: true });
}

export async function rateBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const id = Number((req.params as any).id);
  const parsed = rateSchema.parse(req.body || {});
  // require auth
  try {
    await (req as any).jwtVerify();
    const payload: any = (req as any).user;
    const userId = Number(payload.userId);

    // upsert rating
    const existing = await prisma.rating.findUnique({ where: { userId_bookId: { userId, bookId: id } } }).catch(() => null);
    if (existing) {
      const updated = await prisma.rating.update({ where: { id: existing.id }, data: { score: parsed.score, review: parsed.review }});
      return reply.send({ rating: updated });
    } else {
      const created = await prisma.rating.create({ data: { userId, bookId: id, score: parsed.score, review: parsed.review }});
      return reply.send({ rating: created });
    }
  } catch (e) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function listGenresHandler(req: FastifyRequest, reply: FastifyReply) {
  const genres = await prisma.genre.findMany({ orderBy: { name: 'asc' }});
  return reply.send({ genres });
}


export async function replaceFileHandler(req: FastifyRequest, reply: FastifyReply) {
  const id = Number((req.params as any).id);
  if (!(req as any).isMultipart || !(req as any).isMultipart()) return reply.code(415).send({ error: 'Expected multipart/form-data' });

  try {
    await (req as any).jwtVerify();
  } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
  const payload: any = (req as any).user;
  const user = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
  const book = await prisma.book.findUnique({ where: { id }});
  if (!book) return reply.code(404).send({ error: 'Book not found' });
  const isOwner = user && user.id === book.uploadedById;
  const isAdmin = user && user.role === 'ADMIN';
  if (!isOwner && !isAdmin) return reply.code(403).send({ error: 'Forbidden' });

  const part = await (req as any).file();
  if (!part || !part.file) return reply.code(400).send({ error: 'file required' });
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${Date.now()}_${uuidv4()}_${part.filename}`;
  const filepath = path.join(uploadDir, filename);
  const ws = fs.createWriteStream(filepath);
  await new Promise<void>((resolve, reject) => {
    part.file.pipe(ws);
    part.file.on('error', (err: any) => reject(err));
    ws.on('error', (err) => reject(err));
    ws.on('finish', () => resolve());
  });

  // update DB and remove old file
  try {
    const old = book.filePath;
    await prisma.book.update({ where: { id }, data: { filePath: filepath }});
    if (old && fs.existsSync(old)) fs.unlinkSync(old);
    const updated = await prisma.book.findUnique({ where: { id }});
    return reply.send({ book: updated });
  } catch (err: any) {
    return reply.code(500).send({ error: 'Failed to replace file' });
  }
}

export async function uploadCoverHandler(req: FastifyRequest, reply: FastifyReply) {
  const id = Number((req.params as any).id);
  if (!(req as any).isMultipart || !(req as any).isMultipart()) return reply.code(415).send({ error: 'Expected multipart/form-data' });

  try { await (req as any).jwtVerify(); } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
  const payload: any = (req as any).user;
  const user = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
  const book = await prisma.book.findUnique({ where: { id }});
  if (!book) return reply.code(404).send({ error: 'Book not found' });
  const isOwner = user && user.id === book.uploadedById;
  const isAdmin = user && user.role === 'ADMIN';
  if (!isOwner && !isAdmin) return reply.code(403).send({ error: 'Forbidden' });

  const part = await (req as any).file(); // expecting single part named cover (or file)
  if (!part || !part.file) return reply.code(400).send({ error: 'cover file required' });
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${Date.now()}_${uuidv4()}_${part.filename}`;
  const filepath = path.join(uploadDir, filename);
  const ws = fs.createWriteStream(filepath);
  await new Promise<void>((resolve, reject) => {
    part.file.pipe(ws);
    part.file.on('error', (err: any) => reject(err));
    ws.on('error', (err) => reject(err));
    ws.on('finish', () => resolve());
  });

  await prisma.book.update({ where: { id }, data: { coverPath: filepath }});
  const updated = await prisma.book.findUnique({ where: { id }});
  return reply.send({ book: updated });
}

export async function listRatingsHandler(req: FastifyRequest, reply: FastifyReply) {
  const bookId = Number((req.params as any).id);
  if (!bookId) return reply.code(400).send({ error: 'Invalid book id' });

  try {
    const ratings = await prisma.rating.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    // convert to a simpler public shape (avoid leaking sensitive info)
    const out = ratings.map(r => ({
      id: r.id,
      user: r.user ? { id: r.user.id, name: r.user.name } : null,
      score: r.score,
      review: r.review,
      createdAt: r.createdAt
    }));

    return reply.send({ ratings: out });
  } catch (err: any) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Failed to fetch ratings' });
  }
}
