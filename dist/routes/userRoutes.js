"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const usersController_1 = require("../controllers/usersController");
const verifyJWT_1 = __importDefault(require("../middleware/verifyJWT"));
const router = express_1.default.Router();
// Authentication
router.post('/users/login', usersController_1.userLogin);
// Registration
router.post('/users', usersController_1.registerUser);
// Get Current User
router.get('/user', verifyJWT_1.default, usersController_1.getCurrentUser);
// Update User
router.put('/user', verifyJWT_1.default, usersController_1.updateUser);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map