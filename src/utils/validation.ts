import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    password: z.string()
        .min(8)
        .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Must contain at least one number')
        .regex(/[!@#$%^&*]/, 'Must contain at least one special character')
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().uuid('Invalid refresh token format')
});

export const bookSchema = z.object({
    title: z.string().min(2).max(255),
    authors: z.array(z.string().min(2).max(100)).nonempty(),
    description: z.string().max(1000).optional(),
    isbn: z.string().regex(/^[\d-]+$/).optional(),
    categories: z.array(z.string().min(2)).nonempty(),
    fileKey: z.string(),
    coverKey: z.string().optional(),
    visibility: z.enum(['PUBLIC', 'PRIVATE'])
});

export const ratingSchema = z.object({
    rating: z.number().int().min(1).max(5)
});

export const reviewSchema = z.object({
    content: z.string().min(10).max(1000),
    isSpoiler: z.boolean().default(false)
});