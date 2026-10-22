import express from 'express';
import getAuthMiddleware from '../middleware/AuthMiddleware';
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
const authMiddleware = getAuthMiddleware();

// feed endpoint must go before :slug endpoint
router.get('/feed', authMiddleware.required(), feedArticles);

router.get('/', authMiddleware.optional(), listArticles);

router.get('/:slug', authMiddleware.optional(), getArticleWithSlug);

router.post('/', authMiddleware.required(), createArticle);

router.delete('/:slug', authMiddleware.required(), deleteArticle);

router.post('/:slug/favorite', authMiddleware.required(), favoriteArticle);

router.delete('/:slug/favorite', authMiddleware.required(), unfavoriteArticle);

router.put('/:slug', authMiddleware.required(), updateArticle);

export default router;