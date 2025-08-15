import { Router } from 'express';
import AuthController from '../../controllers/auth.controller';
import validate from '../../middleware/validate.middleware';
import { loginSchema, registerSchema } from '../../schemas/auth.schema';

const router = Router();
const authController = new AuthController();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

export default router;