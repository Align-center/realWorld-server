"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const profilesController_1 = require("../controllers/profilesController");
const verifyJWT_1 = __importDefault(require("../middleware/verifyJWT"));
const verifyJWTOptional_1 = __importDefault(require("../middleware/verifyJWTOptional"));
const router = express_1.default.Router();
// Get profile - authentication optional
router.get('/:username', verifyJWTOptional_1.default, profilesController_1.getProfile);
// Follow a user
router.post('/:username/follow', verifyJWT_1.default, profilesController_1.followUser);
// unfollow a user
router.delete('/:username/follow', verifyJWT_1.default, profilesController_1.unFollowUser);
exports.default = router;
//# sourceMappingURL=profileRoutes.js.map