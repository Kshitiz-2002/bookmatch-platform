import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { logger } from '../lib/logger.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../utils/validation.js';
import { generateAccessToken } from '../utils/jwt.js';
import { config } from '../config/config.js';
import HttpStatusCode from '../constants/http.js';


export class AuthController {
    private authService: AuthService;

    constructor(authService: AuthService) {
        this.authService = authService;
    }

    register = async (req: Request, res: Response) => {
        try {
            const validatedData = registerSchema.parse(req.body);
            const { user, refreshToken } = await this.authService.register(validatedData);
            
            // Generate access token
            const accessToken = generateAccessToken(user.id, config.JWT_SECRET, config.JWT_EXPIRES_IN);
            
            res.status(HttpStatusCode.CREATED).json({
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    roles: user.roles
                },
                accessToken,
                refreshToken
            });
        } catch (error) {
            logger.error('Registration failed', error);
            res.status(HttpStatusCode.BAD_REQUEST).json({ 
                error: 'Registration failed', 
                details: error.errors || error.message 
            });
        }
    };

    login = async (req: Request, res: Response) => {
        try {
            const validatedData = loginSchema.parse(req.body);
            const { user, refreshToken } = await this.authService.login(validatedData);
            
            // Generate access token
            const accessToken = generateAccessToken(user.id, config.JWT_SECRET, config.JWT_EXPIRES_IN);
            
            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    roles: user.roles
                },
                accessToken,
                refreshToken
            });
        } catch (error) {
            logger.error('Login failed', error);
            res.status(HttpStatusCode.UNAUTHORIZED).json({ 
                error: 'Invalid credentials', 
                details: error.message 
            });
        }
    };

    refreshToken = async (req: Request, res: Response) => {
        try {
            const { refreshToken } = refreshTokenSchema.parse(req.body);
            const { accessToken, newRefreshToken } = await this.authService.refreshToken(refreshToken);
            
            res.json({ 
                accessToken, 
                refreshToken: newRefreshToken 
            });
        } catch (error) {
            logger.error('Token refresh failed', error);
            res.status(HttpStatusCode.UNAUTHORIZED).json({ 
                error: 'Invalid refresh token', 
                details: error.message 
            });
        }
    };

    logout = async (req: Request, res: Response) => {
        try {
            const { refreshToken } = refreshTokenSchema.parse(req.body);
            await this.authService.logout(refreshToken);
            res.status(HttpStatusCode.NO_CONTENT).send();
        } catch (error) {
            logger.error('Logout failed', error);
            res.status(HttpStatusCode.BAD_REQUEST).json({ 
                error: 'Logout failed', 
                details: error.message 
            });
        }
    };
}