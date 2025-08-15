import type { Request, Response } from 'express';
import { HttpStatusCode } from '../constants/http';
import { logger } from '../lib/logger';
import { UserService } from '../services/user.service';

export class UserController {
    private userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    getCurrentUser = async (req: Request, res: Response) => {
        try {
            const user = await this.userService.getUserById(req.user!.id);
            
            res.json({
                id: user.id,
                email: user.email,
                name: user.name,
                roles: user.roles
            });
        } catch (error) {
            logger.error('Failed to fetch user', error);
            res.status(HttpStatusCode.NOT_FOUND).json({ 
                error: 'User not found' 
            });
        }
    };

    updateCurrentUser = async (req: Request, res: Response) => {
        try {
            const updatedUser = await this.userService.updateUser(
                req.user!.id, 
                req.body
            );
            
            res.json({
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                roles: updatedUser.roles
            });
        } catch (error) {
            logger.error('User update failed', error);
            res.status(HttpStatusCode.BAD_REQUEST).json({ 
                error: 'Update failed', 
                details: error.message 
            });
        }
    };

    getUserRecommendations = async (req: Request, res: Response) => {
        try {
            const userId = req.params.id;
            const count = parseInt(req.query.n as string) || 20;
            
            // Authorization: Only allow users to access their own recommendations
            if (req.user!.id !== userId && !req.user!.roles.includes('admin')) {
                return res.status(HttpStatusCode.FORBIDDEN).json({ 
                    error: 'Access denied' 
                });
            }
            
            const recommendations = await this.userService.getRecommendations(userId, count);
            res.json({ items: recommendations });
        } catch (error) {
            logger.error('Recommendations fetch failed', error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ 
                error: 'Failed to get recommendations' 
            });
        }
    };
}