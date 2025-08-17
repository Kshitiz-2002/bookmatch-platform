import crypto from "crypto";
import argon2 from "argon2";

/**
 * Access token creation is done in auth.service (needs jwt).
 * This module only helps create/verify refresh raw token parts and produce hashed values.
 */

/**
 * Create a raw refresh token and its hash.
 * We'll use a token format: "<tokenId>.<raw>" where tokenId is random UUID-like (crypto.randomUUID).
 * The server stores tokenId & hashed raw; client receives the combined string.
 */
export async function createRefreshRaw() {
  const tokenId = crypto.randomUUID();
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = await argon2.hash(raw);
  const tokenForClient = `${tokenId}.${raw}`;
  return { tokenId, raw, hash, tokenForClient };
}

/**
 * Verify a raw token against stored hash.
 * Input `clientToken` is "<tokenId>.<raw>"
 */
export async function verifyRefreshRaw(clientToken: string, storedHash: string) {
  const parts = clientToken.split(".");
  if (parts.length < 2) return false;
  const raw = parts.slice(1).join(".");
  try {
    return await argon2.verify(storedHash, raw);
  } catch {
    return false;
  }
}
