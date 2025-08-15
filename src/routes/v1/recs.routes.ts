import { Router } from 'express';
import RecsController from '../../controllers/recs.controller';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const recsController = new RecsController();

router.get('/user/:userId/top', authMiddleware, recsController.getUserTopRecommendations);
router.get('/book/:bookId/similar', recsController.getSimilarBooks);
router.post('/train', authMiddleware, adminMiddleware, recsController.trainModel);
router.get('/status/:jobId', authMiddleware, adminMiddleware, recsController.getJobStatus);

export default router;