import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config.js';

type TokenPayload = { userId: string };

export const generateAccessToken = (
  userId: string,
  secret: string,
  expiresIn: string
) => {
  return jwt.sign(
    { userId } as TokenPayload,
    secret as jwt.Secret,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
  );
};

export const generateRefreshToken = (): string => {
  return uuidv4();
};

export const verifyAccessToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET as jwt.Secret);
    const payload = decoded as jwt.JwtPayload;

    if (!payload || typeof decoded === 'string' || typeof payload.userId !== 'string') {
      return { valid: false, expired: false, error: 'Invalid token payload' };
    }

    return { userId: payload.userId, valid: true };
  } catch (err: unknown) {
    const e = err as Error & { name?: string };
    return {
      valid: false,
      expired: e.name === 'TokenExpiredError',
      error: e.message
    };
  }
};

export const decodeToken = (token: string): TokenPayload | null => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string') return null;
  return decoded as TokenPayload;
};
