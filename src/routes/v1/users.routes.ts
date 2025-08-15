import { Router } from 'express';
import UserController from '../../controllers/user.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const userController = new UserController();

router.get('/me', authMiddleware, userController.getCurrentUser);
router.patch('/me', authMiddleware, userController.updateCurrentUser);
router.get('/:id/recommendations', authMiddleware, userController.getUserRecommendations);

export default router;