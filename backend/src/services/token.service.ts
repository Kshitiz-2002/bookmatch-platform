import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/db';
import type { RefreshToken } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'dev';
const ACCESS_EXPIRES = '7d';
const REFRESH_EXPIRES_DAYS = 10;

export function generateAccessToken(userId: number) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export async function createRefreshToken(userId: number) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  const record = await prisma.refreshToken.create({
    data: { token, userId, expiresAt }
  });
  return record;
}

export type VerifyRefreshResult =
  | { ok: false; reason: 'not_found' | 'revoked' | 'expired' }
  | { ok: true; record: RefreshToken };

export async function verifyRefreshToken(token: string): Promise<VerifyRefreshResult> {
  const record = await prisma.refreshToken.findUnique({ where: { token } });
  if (!record) return { ok: false, reason: 'not_found' };
  if (record.revoked) return { ok: false, reason: 'revoked' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };
  return { ok: true, record };
}

export type RotateRefreshResult =
  | { ok: false; reason?: string }
  | { ok: true; newToken: RefreshToken };

export async function rotateRefreshToken(oldToken: string): Promise<RotateRefreshResult> {
  const v = await verifyRefreshToken(oldToken);
  if (!v.ok) return { ok: false, reason: v.reason };

  // revoke old token
  await prisma.refreshToken.update({ where: { token: oldToken }, data: { revoked: true } });

  // create and return new token
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const newRec = await prisma.refreshToken.create({
    data: { token, userId: v.record.userId, expiresAt }
  });

  return { ok: true, newToken: newRec };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true }});
}
