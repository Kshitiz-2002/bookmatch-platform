// api/src/services/auth.service.ts
import prisma from "../lib/prismaClient";
import argon2 from "argon2";
import * as jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "replace_this_secret_in_prod";
const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || "15m";
const REFRESH_TOKEN_EXP = process.env.REFRESH_TOKEN_EXP || "30d";

function parseExpiresToSeconds(exp: string): number {
  // supports values like "15m", "1h", "30s" or plain numbers (seconds)
  const trimmed = exp.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);

  const match = trimmed.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error("Unsupported expires format: " + exp);

  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s": return val;
    case "m": return val * 60;
    case "h": return val * 3600;
    case "d": return val * 86400;
    default: throw new Error("Unsupported unit");
  }
}


/**
 * Create JWT access token (short-lived)
 */
function generateAccessToken(user: { id: string; email?: string; roles?: string[] }) {
  const payload = { email: user.email, roles: user.roles || [] };
  const expiresSeconds = parseExpiresToSeconds(ACCESS_TOKEN_EXP);

  const opts: jwt.SignOptions = {
    subject: user.id,
    expiresIn: expiresSeconds, // number matches SignOptions type
  };

  const secret: jwt.Secret = JWT_SECRET as jwt.Secret;
  return jwt.sign(payload, secret, opts);
}


/**
 * Create opaque refresh token and store hashed version in DB
 */
async function createRefreshToken(userId: string) {
  const token = crypto.randomBytes(64).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.refreshToken.create({ data: { userId, tokenHash }});
  return token;
}

/**
 * Find refresh token record by opaque token
 */
async function findRefreshTokenRecord(token: string) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return prisma.refreshToken.findFirst({ where: { tokenHash, revoked: false }});
}

/**
 * Register user
 */
export async function registerUser(name: string | undefined, email: string, password: string) {
  if (!email || !password) throw new Error("Invalid input");
  const existing = await prisma.user.findUnique({ where: { email }});
  if (existing) throw new Error("Email already in use");

  const hashed = await argon2.hash(password);
  const user = await prisma.user.create({ data: { name, email, password: hashed }});

  const accessToken = generateAccessToken({ id: user.id, email: user.email, roles: user.roles });
  const refreshToken = await createRefreshToken(user.id);

  return {
    user: { id: user.id, name: user.name, email: user.email, roles: user.roles },
    accessToken,
    refreshToken
  };
}

/**
 * Login user
 */
export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email }});
  if (!user) throw new Error("Invalid credentials");

  const ok = await argon2.verify(user.password, password);
  if (!ok) throw new Error("Invalid credentials");

  const accessToken = generateAccessToken({ id: user.id, email: user.email, roles: user.roles });
  const refreshToken = await createRefreshToken(user.id);

  return {
    user: { id: user.id, name: user.name, email: user.email, roles: user.roles },
    accessToken,
    refreshToken
  };
}

/**
 * Refresh access token using opaque refresh token.
 * Rotates refresh token (revokes old, issues new).
 */
export async function refreshAccessToken(refreshToken: string) {
  const rec = await findRefreshTokenRecord(refreshToken);
  if (!rec) throw new Error("Invalid refresh token");

  const user = await prisma.user.findUnique({ where: { id: rec.userId }});
  if (!user) throw new Error("User does not exist");

  // Revoke old token
  await prisma.refreshToken.update({ where: { id: rec.id }, data: { revoked: true, lastUsedAt: new Date() }});

  // Issue new pair
  const newRefresh = await createRefreshToken(user.id);
  const accessToken = generateAccessToken({ id: user.id, email: user.email, roles: user.roles });

  return { accessToken, refreshToken: newRefresh };
}

/**
 * Logout (revoke provided refresh token)
 */
export async function revokeRefreshToken(refreshToken: string) {
  const rec = await findRefreshTokenRecord(refreshToken);
  if (!rec) return false;
  await prisma.refreshToken.update({ where: { id: rec.id }, data: { revoked: true }});
  return true;
}
