import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev';
// Access token lifetime (keep short-ish). We'll use 7 days for access token.
const ACCESS_EXPIRES = '7d';
// Refresh token lifetime in days (you asked "after 10 days or so")
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

export async function verifyRefreshToken(token: string) {
  const record = await prisma.refreshToken.findUnique({ where: { token } });
  if (!record) return { ok: false, reason: 'not_found' };
  if (record.revoked) return { ok: false, reason: 'revoked' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };
  return { ok: true, record };
}

// Rotate: mark old token revoked and create a new one
export async function rotateRefreshToken(oldToken: string) {
  const v = await verifyRefreshToken(oldToken);
  if (!v.ok) return { ok: false, reason: v.reason };

  // revoke old
  await prisma.refreshToken.update({ where: { token: oldToken }, data: { revoked: true } });

  // create new
  const newRec = await createRefreshToken(v.record.userId);
  return { ok: true, newToken: newRec };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true }});
}