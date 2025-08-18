import { FastifyReply, FastifyRequest } from 'fastify';
import * as authService from '../services/auth.service';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { generateAccessToken, createRefreshToken, rotateRefreshToken, verifyRefreshToken, revokeRefreshToken } from '../services/token.service';
import { prisma } from '../lib/db';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string()
});

export async function registerHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = registerSchema.parse(req.body);
    try {
      const user = await authService.createUser(parsed);
      const access = generateAccessToken(user.id);
      const refreshRec = await createRefreshToken(user.id);
      return reply.code(201).send({ accessToken: access, refreshToken: refreshRec.token, user });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return reply.code(409).send({ error: 'Email already in use' });
      }
      req.log.error(e);
      return reply.code(500).send({ error: 'Failed to create user' });
    }
  } catch (err: any) {
    return reply.code(400).send({ error: 'Invalid payload', details: err.errors ?? err.message });
  }
}

export async function loginHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await authService.authenticateUser(parsed.email, parsed.password);
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });
    const access = generateAccessToken(user.id);
    const refreshRec = await createRefreshToken(user.id);
    return reply.send({ accessToken: access, refreshToken: refreshRec.token, user });
  } catch (err: any) {
    return reply.code(400).send({ error: 'Invalid payload', details: err.errors ?? err.message });
  }
}

export async function refreshHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = refreshSchema.parse(req.body);
    const token = parsed.refreshToken;
    const v = await verifyRefreshToken(token);
    if (!v.ok) {
      return reply.code(401).send({ error: 'Invalid refresh token', reason: v.reason });
    }
    // rotate refresh token for safety
    const rotated = await rotateRefreshToken(token);
    if (!rotated.ok) return reply.code(401).send({ error: 'Failed to rotate refresh token' });

    const access = generateAccessToken(rotated.newToken.userId);
    return reply.send({ accessToken: access, refreshToken: rotated.newToken.token });
  } catch (err: any) {
    return reply.code(400).send({ error: 'Invalid payload', details: err.errors ?? err.message });
  }
}

export async function logoutHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const body: any = req.body || {};
    const token = body.refreshToken;
    if (!token) return reply.code(400).send({ error: 'refreshToken required' });
    await revokeRefreshToken(token);
    return reply.send({ ok: true });
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Logout failed' });
  }
}

export async function meHandler(req: FastifyRequest, reply: FastifyReply) {
  // verify token and return current user
  try {
    await (req as any).jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const payload: any = (req as any).user;
  const userId = Number(payload?.userId);
  if (!userId) return reply.code(401).send({ error: 'Invalid token payload' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  });

  if (!user) return reply.code(404).send({ error: 'User not found' });
  return reply.send({ user });
}

