import type { Request, Response } from 'express';
import { HttpStatusCode } from '../constants/http';
import { logger } from '../lib/logger';
import { analyticsService } from '../services/analytics.service';
import { BookService } from '../services/book.service';
import { validateBookAccess } from '../utils/book.utils';

export class BookController {
    private bookService: BookService;

    constructor(bookService: BookService) {
        this.bookService = bookService;
    }

    getUploadUrl = async (req: Request, res: Response) => {
        try {
            const { fileName, contentType, size } = req.body;
            const uploadData = await this.bookService.getPresignedUrl(
                fileName, 
                contentType, 
                size
            );
            
            res.json(uploadData);
        } catch (error) {
            logger.error('Upload URL generation failed', error);
            res.status(HttpStatusCode.BAD_REQUEST).json({ 
                error: 'Invalid file parameters' 
            });
        }
    };

    createBook = async (req: Request, res: Response) => {
        try {
            const book = await this.bookService.createBook(
                req.user!.id, 
                req.body
            );
            
            res.status(HttpStatusCode.CREATED).json(book);
        } catch (error) {
            logger.error('Book creation failed', error);
            res.status(HttpStatusCode.BAD_REQUEST).json({ 
                error: 'Book creation failed', 
                details: error.message 
            });
        }
    };

    getBooks = async (req: Request, res: Response) => {
        try {
            const { 
                q, 
                author, 
                category, 
                page = 1, 
                limit = 10, 
                sort = 'popular' 
            } = req.query;
            
            const books = await this.bookService.getBooks({
                query: q as string,
                author: author as string,
                category: category as string,
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                sort: sort as string
            });
            
            res.json(books);
        } catch (error) {
            logger.error('Books fetch failed', error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ 
                error: 'Failed to fetch books' 
            });
        }
    };

    getBook = async (req: Request, res: Response) => {
        try {
            const book = await this.bookService.getBookById(req.params.id);
            
            // Record impression event
            await analyticsService.recordEvent({
                userId: req.user?.id,
                bookId: book.id,
                event: 'impression',
                meta: { source: 'book_page' }
            });
            
            res.json(book);
        } catch (error) {
            logger.error('Book fetch failed', error);
            res.status(HttpStatusCode.NOT_FOUND).json({ 
                error: 'Book not found' 
            });
        }
    };

    readBook = async (req: Request, res: Response) => {
        try {
            const bookId = req.params.id;
            const book = await validateBookAccess(bookId, req.user?.id);
            
            // Record open event
            await analyticsService.recordEvent({
                userId: req.user?.id,
                bookId: book.id,
                event: 'open'
            });
            
            // Get signed URL for reading
            const readUrl = await this.bookService.getReadUrl(book.fileKey);
            res.json({ url: readUrl });
        } catch (error) {
            logger.error('Book read access failed', error);
            res.status(HttpStatusCode.FORBIDDEN).json({ 
                error: 'Access denied' 
            });
        }
    };

    // Other book methods (update, delete, download) follow similar patterns
}