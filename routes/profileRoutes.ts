import express from 'express';
import { getProfile, followUser, unFollowUser } from '../controllers/profilesController';
import getAuthMiddleware from '../middleware/AuthMiddleware';

const router = express.Router();
const authMiddleware = getAuthMiddleware();

// Get profile - authentication optional
router.get('/:username', authMiddleware.optional(), getProfile);

// Follow a user
router.post('/:username/follow', authMiddleware.required(), followUser);

// unfollow a user
router.delete('/:username/follow', authMiddleware.required(), unFollowUser);

export default router;