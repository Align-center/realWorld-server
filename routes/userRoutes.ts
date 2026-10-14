import express from 'express';
import { registerUser, getCurrentUser, userLogin, updateUser } from '../controllers/usersController';
import verifyJWT from '../middleware/verifyJWT';

const router = express.Router();

// Authentication
router.post('/users/login', userLogin);

// Registration
router.post('/users', registerUser);

// Get Current User
router.get('/user', verifyJWT, getCurrentUser);

// Update User
router.put('/user', verifyJWT, updateUser);

export default router;