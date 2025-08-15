import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config';
import { logger } from './logger';

interface TokenPayload {
  userId: string;
}

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
    issuer: 'bookmatch-api',
    audience: 'bookmatch-client'
  });
};

export const generateRefreshToken = (): string => {
  return uuidv4();
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
  } catch (err) {
    logger.error('JWT verification failed', { error: err.message });
    throw new Error('Invalid token');
  }
};

export const decodeTokenWithoutVerification = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch (err) {
    logger.error('JWT decoding failed', { error: err.message });
    return null;
  }
};