import express from 'express';
import verifyJWT from '../middleware/verifyJWT';
import verifyJWTOptional from '../middleware/verifyJWTOptional';
import {
    createArticle,
    deleteArticle,
    favoriteArticle,
    unfavoriteArticle,
    getArticleWithSlug,
    updateArticle,
    feedArticles,
    listArticles
} from '../controllers/articlesController';

const router = express.Router();

// feed endpoint must go before :slug endpoint
router.get('/feed', verifyJWT, feedArticles);

router.get('/', verifyJWTOptional, listArticles);

router.get('/:slug', verifyJWTOptional, getArticleWithSlug);

router.post('/', verifyJWT, createArticle);

router.delete('/:slug', verifyJWT, deleteArticle);

router.post('/:slug/favorite', verifyJWT, favoriteArticle);

router.delete('/:slug/favorite', verifyJWT, unfavoriteArticle);

router.put('/:slug', verifyJWT, updateArticle);

export default router;