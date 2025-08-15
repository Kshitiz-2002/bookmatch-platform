import { Router } from 'express';
import BookController from '../../controllers/book.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { bookSchema } from '../../schemas/book.schema';

const router = Router();
const bookController = new BookController();

router.post('/upload-url', authMiddleware, bookController.getUploadUrl);
router.post('/', authMiddleware, validate(bookSchema), bookController.createBook);
router.get('/', bookController.getBooks);
router.get('/:id', bookController.getBook);
router.patch('/:id', authMiddleware, bookController.updateBook);
router.delete('/:id', authMiddleware, bookController.deleteBook);
router.get('/:id/read', bookController.readBook);
router.get('/:id/download', bookController.downloadBook);

export default router;