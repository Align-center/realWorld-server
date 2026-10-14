"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const verifyJWT_1 = __importDefault(require("../middleware/verifyJWT"));
const verifyJWTOptional_1 = __importDefault(require("../middleware/verifyJWTOptional"));
const commentsController_1 = require("../controllers/commentsController");
const router = express_1.default.Router();
router.post('/:slug/comments', verifyJWT_1.default, commentsController_1.addCommentsToArticle);
router.get('/:slug/comments', verifyJWTOptional_1.default, commentsController_1.getCommentsFromArticle);
router.delete('/:slug/comments/:id', verifyJWT_1.default, commentsController_1.deleteComment);
exports.default = router;
//# sourceMappingURL=commentRoutes.js.map