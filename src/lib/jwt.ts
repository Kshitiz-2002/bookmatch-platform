import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config';
import type { User } from '@prisma/client';
import logger from '../lib/logger';

// Token payload structure
interface TokenPayload {
  userId: string;
  roles: string[];
}

// Generate access token
export const generateAccessToken = (user: User): string => {
  const payload: TokenPayload = {
    userId: user.id,
    roles: user.roles
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
    issuer: 'bookmatch-api',
    audience: 'bookmatch-client',
    algorithm: 'HS256'
  });
};

// Generate refresh token (opaque token)
export const generateRefreshToken = (): string => {
  return uuidv4();
};

// Verify access token
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'bookmatch-api',
      audience: 'bookmatch-client'
    }) as TokenPayload;
  } catch (error) {
    logger.error('JWT verification failed', error);
    throw new Error('Invalid token');
  }
};

// Decode token without verification
export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch (error) {
    logger.error('Token decoding failed', error);
    return null;
  }
};