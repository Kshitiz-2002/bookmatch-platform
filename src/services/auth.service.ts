import { argon2id, hash, verify } from 'argon2';
import prisma from '../lib/prisma';
import { generateAccessToken, generateRefreshToken } from '../lib/jwt';
import { logger } from '../lib/logger';
import { redis } from '../lib/redis';
import { config } from '../config/config';

class AuthService {
  async register(name: string, email: string, password: string) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const hashedPassword = await hash(password, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roles: ['user']
      }
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: await this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + parseInt(config.REFRESH_TOKEN_EXPIRY) * 1000)
      }
    });

    // Cache user data
    await redis.set(`user:${user.id}`, JSON.stringify({
      id: user.id,
      roles: user.roles
    }), 3600); // Cache for 1 hour

    return { user, accessToken, refreshToken };
  }

  async login(email: string, password: string) {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const valid = await verify(user.password, password);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: await this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + parseInt(config.REFRESH_TOKEN_EXPIRY) * 1000)
      }
    });

    // Cache user data
    await redis.set(`user:${user.id}`, JSON.stringify({
      id: user.id,
      roles: user.roles
    }), 3600); // Cache for 1 hour

    return { user, accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string) {
    // Find token in database
    const hashedToken = await this.hashToken(refreshToken);
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true }
    });

    // Validate token
    if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      throw new Error('Invalid refresh token');
    }

    // Generate new tokens
    const accessToken = generateAccessToken(tokenRecord.userId);
    const newRefreshToken = generateRefreshToken();

    // Replace old token
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revoked: true }
      }),
      prisma.refreshToken.create({
        data: {
          token: await this.hashToken(newRefreshToken),
          userId: tokenRecord.userId,
          expiresAt: new Date(Date.now() + parseInt(config.REFRESH_TOKEN_EXPIRY) * 1000)
        }
      })
    ]);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    const hashedToken = await this.hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { token: hashedToken },
      data: { revoked: true }
    });
  }

  private async hashToken(token: string): Promise<string> {
    return hash(token, { type: argon2id });
  }
}

export default new AuthService();