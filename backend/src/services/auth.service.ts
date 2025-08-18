import { prisma } from '../lib/db';
import { hashPassword, comparePassword } from '../lib/hash';

export async function createUser(data: { email: string; password: string; name?: string }) {
  const hashed = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: { email: data.email.toLowerCase(), password: hashed, name: data.name },
    select: { id: true, email: true, name: true, createdAt: true }
  });
  return user;
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;
  const ok = await comparePassword(password, user.password);
  if (!ok) return null;
  // return minimal user data (avoid returning password)
  return { id: user.id, email: user.email, name: user.name };
}

export async function getUserById(id: number) {
  return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, createdAt: true }});
}
