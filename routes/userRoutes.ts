import express from 'express';
import { registerUser, getCurrentUser, userLogin, updateUser } from '../controllers/usersController';
import getAuthMiddleware from '../middleware/AuthMiddleware';

const router = express.Router();
const authMiddleware = getAuthMiddleware();

// Authentication
router.post('/users/login', userLogin);

// Registration
router.post('/users', registerUser);

// Get Current User
router.get('/user', authMiddleware.required(), getCurrentUser);

// Update User
router.put('/user', authMiddleware.required(), updateUser);

export default router;