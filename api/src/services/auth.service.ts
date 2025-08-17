import prisma from "../prisma/client";
import jwt from "jsonwebtoken";
import { createRefreshRaw, verifyRefreshRaw } from "./token.service";

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET: string = process.env.JWT_SECRET; // now definitely string

const DEFAULT_ACCESS_EXPIRES = "15m";

function getAccessExpires(): jwt.SignOptions["expiresIn"] {
  const raw = process.env.JWT_ACCESS_EXPIRES ?? DEFAULT_ACCESS_EXPIRES;
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }
  return raw as jwt.SignOptions["expiresIn"];
}

export function createAccessToken(userId: string, roles: string[] = ["user"]) {
  const options: jwt.SignOptions = {
    subject: userId,
    expiresIn: getAccessExpires()
  };
  const payload = { roles };
  return jwt.sign(payload, JWT_SECRET, options); // no TS errors now
}
function computeExpiryDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function register({ name, email, password }: { name: string; email: string; password: string }) {
  // create user
  const user = await prisma.user.create({
    data: { name, email, password } // assume password already hashed upstream or using Prisma middleware; for clarity hash here:
  });
  // NOTE: you should hash password before calling create. For simplicity the calling route must ensure hashing.
  // create tokens
  const accessToken = createAccessToken(user.id, user.roles);
  const r = await createRefreshRaw();
  await prisma.refreshToken.create({
    data: { id: r.tokenId, userId: user.id, tokenHash: r.hash, expiresAt: computeExpiryDate(REFRESH_EXPIRES_DAYS) }
  });
  return {
    user: { id: user.id, email: user.email, name: user.name, roles: user.roles },
    accessToken,
    refreshToken: r.tokenForClient
  };
}

/**
 * login expects caller to have validated password and hashed in DB.
 * Here we validate password.
 */
import argon2 from "argon2";

export async function login({ email, password }: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw { status: 401, message: "Invalid credentials" };
  const ok = await argon2.verify(user.password, password);
  if (!ok) throw { status: 401, message: "Invalid credentials" };

  const accessToken = createAccessToken(user.id, user.roles);
  const r = await createRefreshRaw();
  await prisma.refreshToken.create({
    data: { id: r.tokenId, userId: user.id, tokenHash: r.hash, expiresAt: computeExpiryDate(REFRESH_EXPIRES_DAYS) }
  });

  return { user: { id: user.id, email: user.email, name: user.name, roles: user.roles }, accessToken, refreshToken: r.tokenForClient };
}

/**
 * Refresh: token format "<tokenId>.<raw>"
 */
export async function refresh({ refreshToken }: { refreshToken: string }) {
  const parts = refreshToken?.split(".");
  if (!parts || parts.length < 2) throw { status: 401, message: "Invalid refresh token" };
  const tokenId = parts[0];

  const stored = await prisma.refreshToken.findUnique({ where: { id: tokenId } });
  if (!stored || stored.revoked) throw { status: 401, message: "Invalid refresh token" };
  if (stored.expiresAt < new Date()) throw { status: 401, message: "Refresh token expired" };

  const ok = await verifyRefreshRaw(refreshToken, stored.tokenHash);
  if (!ok) throw { status: 401, message: "Invalid refresh token" };

  // rotate: revoke old and create new
  await prisma.refreshToken.update({ where: { id: tokenId }, data: { revoked: true } });
  const newR = await createRefreshRaw();
  await prisma.refreshToken.create({
    data: { id: newR.tokenId, userId: stored.userId, tokenHash: newR.hash, expiresAt: computeExpiryDate(REFRESH_EXPIRES_DAYS) }
  });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw { status: 401, message: "User not found" };
  const accessToken = createAccessToken(user.id, user.roles);
  return { accessToken, refreshToken: newR.tokenForClient };
}

/**
 * Logout: revoke token if provided
 */
export async function logout({ refreshToken }: { refreshToken?: string }) {
  if (!refreshToken) return;
  const parts = refreshToken.split(".");
  if (parts.length < 2) return;
  const tokenId = parts[0];
  await prisma.refreshToken.updateMany({ where: { id: tokenId }, data: { revoked: true } });
}
