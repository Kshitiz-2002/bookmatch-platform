import { prisma } from '../lib/prisma';
import { ForbiddenError } from '../errors/ForbiddenError';

export const validateBookAccess = async (bookId: string, userId?: string) => {
    const book = await prisma.book.findUnique({
        where: { id: bookId },
        include: { user: true }
    });

    if (!book) {
        throw new Error('Book not found');
    }

    // Public books are accessible to everyone
    if (book.visibility === 'PUBLIC') {
        return book;
    }

    // Private books are only accessible to the owner
    if (book.userId === userId) {
        return book;
    }

    throw new ForbiddenError('You do not have permission to access this book');
};