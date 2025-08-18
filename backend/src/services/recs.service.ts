import { prisma } from '../lib/db';
import { cosineSimilarity } from '../lib/utils'; // implement helper below

export async function recommendForUser(userId: number, limit = 10, seedBooks: number[] = [], publicOnly = true) {
  // 1. compute user profile from embeddings of read books / rated books
  const ratings = await prisma.rating.findMany({ where: { userId }});
  const userBooks = await prisma.userBook.findMany({ where: { userId }});
  const bookIds = [...new Set([...(ratings.map(r => r.bookId)), ...(userBooks.map(ub => ub.bookId)), ...seedBooks])];

  const embeddings = [];
  for (const id of bookIds) {
    const emb = await prisma.embedding.findFirst({ where: { bookId: id }});
    if (emb?.vector) embeddings.push(emb.vector);
  }
  let userProfile: number[] | null = null;
  if (embeddings.length) {
    const dim = embeddings[0].length;
    const avg = new Array(dim).fill(0);
    for (const v of embeddings) for (let i=0;i<dim;i++) avg[i]+=v[i];
    for (let i=0;i<dim;i++) avg[i] /= embeddings.length;
    userProfile = avg;
  }

  // 2. candidate set
  const where: any = {};
  if (publicOnly) where.isPublic = true;

  const candidates = await prisma.book.findMany({ where, include: { genres: { include: { genre: true } }, ratings: true, embedding: true }});
  // 3. score
  const scored = candidates.map(b => {
    let score = 0;
    if (userProfile && b.embedding?.vector) {
      score = cosineSimilarity(userProfile, b.embedding.vector);
    }
    // add rating popularity as small boost
    const avgRating = b.ratings.length ? (b.ratings.reduce((s, r) => s + r.score, 0) / b.ratings.length) : 0;
    const popularity = Math.log(1 + b.ratings.length);
    score = score + 0.2 * avgRating + 0.05 * popularity;
    return { book: b, score };
  });

  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, limit).map(s => ({ book: s.book, score: s.score }));
}