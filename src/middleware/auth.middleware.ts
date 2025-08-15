import type { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { HttpStatusCode } from '../constants/http';
import logger from '../lib/logger';
import prisma from '../lib/prisma';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                roles: string[];
            };
        }
    }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(HttpStatusCode.UNAUTHORIZED).json({ 
            error: 'Authorization header missing or invalid' 
        });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };
        const user = await prisma.user.findUnique({ 
            where: { id: decoded.userId },
            select: { 
                id: true, 
                roles: true,
                isActive: true
            }
        });

        if (!user || !user.isActive) {
            return res.status(HttpStatusCode.UNAUTHORIZED).json({ 
                error: 'Invalid token' 
            });
        }

        req.user = {
            id: user.id,
            roles: user.roles
        };
        
        next();
    } catch (err) {
        logger.error('JWT verification failed', err);
        
        if (err.name === 'TokenExpiredError') {
            return res.status(HttpStatusCode.UNAUTHORIZED).json({ 
                error: 'Token expired' 
            });
        }
        
        return res.status(HttpStatusCode.FORBIDDEN).json({ 
            error: 'Invalid token' 
        });
    }
};

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.roles.includes('admin')) {
        return res.status(HttpStatusCode.FORBIDDEN).json({ 
            error: 'Admin access required' 
        });
    }
    next();
};

export const roleMiddleware = (requiredRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const hasRequiredRole = requiredRoles.some(role => 
            req.user?.roles.includes(role)
        );
        
        if (!hasRequiredRole) {
            return res.status(HttpStatusCode.FORBIDDEN).json({ 
                error: 'Insufficient permissions' 
            });
        }
        
        next();
    };
};