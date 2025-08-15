import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from 'zod-validation-error';
import { HttpStatusCode } from '../constants/http';
import { ForbiddenError } from '../errors/ForbiddenError';
import logger from '../lib/logger';

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    logger.error(`${err.name}: ${err.message}`, {
        path: req.path,
        method: req.method,
        body: req.body,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });

    // Handle validation errors
    if (err instanceof ValidationError) {
        return res.status(HttpStatusCode.BAD_REQUEST).json({
            error: 'Validation failed',
            details: err.details
        });
    }

    // Handle Prisma errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return handlePrismaError(err, res);
    }

    // Handle custom errors
    if (err instanceof ForbiddenError) {
        return res.status(HttpStatusCode.FORBIDDEN).json({
            error: err.message
        });
    }

    // Default error response
    res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV !== 'production' 
            ? err.message 
            : undefined
    });
};

const handlePrismaError = (
    err: Prisma.PrismaClientKnownRequestError,
    res: Response
) => {
    switch (err.code) {
        case 'P2002':
            return res.status(HttpStatusCode.CONFLICT).json({
                error: 'Duplicate entry',
                fields: err.meta?.target
            });
        case 'P2025':
            return res.status(HttpStatusCode.NOT_FOUND).json({
                error: 'Resource not found'
            });
        default:
            return res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                error: 'Database error'
            });
    }
};

export const notFoundHandler = (req: Request, res: Response) => {
    res.status(HttpStatusCode.NOT_FOUND).json({
        error: 'Endpoint not found'
    });
};