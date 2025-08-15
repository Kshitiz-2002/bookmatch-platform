import { Router } from 'express';
import RatingController from '../../controllers/rating.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { ratingSchema } from '../../schemas/rating.schema';

const router = Router();
const ratingController = new RatingController();

router.post('/:id/rate', authMiddleware, validate(ratingSchema), ratingController.rateBook);
router.get('/:id/ratings', ratingController.getBookRatings);
router.post('/:id/reviews', authMiddleware, ratingController.createReview);

export default router;