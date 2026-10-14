import express from 'express';
import verifyJWT from '../middleware/verifyJWT';
import verifyJWTOptional from '../middleware/verifyJWTOptional';
import {
    addCommentsToArticle,
    getCommentsFromArticle,
    deleteComment
} from '../controllers/commentsController';

const router = express.Router();

router.post('/:slug/comments', verifyJWT, addCommentsToArticle);

router.get('/:slug/comments', verifyJWTOptional, getCommentsFromArticle);

router.delete('/:slug/comments/:id', verifyJWT, deleteComment);

export default router;