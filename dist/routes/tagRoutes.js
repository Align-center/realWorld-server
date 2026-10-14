"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tagsController_1 = require("../controllers/tagsController");
const router = express_1.default.Router();
router.get('/', tagsController_1.getTags);
exports.default = router;
//# sourceMappingURL=tagRoutes.js.map