import express from 'express';
import { getProfile, followUser, unFollowUser } from '../controllers/profilesController';
import verifyJWT from '../middleware/verifyJWT';
import verifyJWTOptional from '../middleware/verifyJWTOptional';

const router = express.Router();

// Get profile - authentication optional
router.get('/:username', verifyJWTOptional, getProfile);

// Follow a user
router.post('/:username/follow', verifyJWT, followUser);

// unfollow a user
router.delete('/:username/follow', verifyJWT, unFollowUser);

export default router;