"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const verifyJWT_1 = __importDefault(require("../middleware/verifyJWT"));
const verifyJWTOptional_1 = __importDefault(require("../middleware/verifyJWTOptional"));
const articlesController_1 = require("../controllers/articlesController");
const router = express_1.default.Router();
// feed endpoint must go before :slug endpoint
router.get('/feed', verifyJWT_1.default, articlesController_1.feedArticles);
router.get('/', verifyJWTOptional_1.default, articlesController_1.listArticles);
router.get('/:slug', verifyJWTOptional_1.default, articlesController_1.getArticleWithSlug);
router.post('/', verifyJWT_1.default, articlesController_1.createArticle);
router.delete('/:slug', verifyJWT_1.default, articlesController_1.deleteArticle);
router.post('/:slug/favorite', verifyJWT_1.default, articlesController_1.favoriteArticle);
router.delete('/:slug/favorite', verifyJWT_1.default, articlesController_1.unfavoriteArticle);
router.put('/:slug', verifyJWT_1.default, articlesController_1.updateArticle);
exports.default = router;
//# sourceMappingURL=articleRoutes.js.map