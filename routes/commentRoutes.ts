import express from 'express';
import getAuthMiddleware from '../middleware/AuthMiddleware';
import {
    addCommentsToArticle,
    getCommentsFromArticle,
    deleteComment
} from '../controllers/commentsController';

const router = express.Router();
const authMiddleware = getAuthMiddleware();

router.post('/:slug/comments', authMiddleware.required(), addCommentsToArticle);

router.get('/:slug/comments', authMiddleware.optional(), getCommentsFromArticle);

router.delete('/:slug/comments/:id', authMiddleware.required(), deleteComment);

export default router;