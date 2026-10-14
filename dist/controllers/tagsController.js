"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTags = void 0;
const Article_1 = __importDefault(require("../models/Article"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const getTags = (0, express_async_handler_1.default)(async (req, res) => {
    // distinct "tagList" will return either an error or a list of distinct tags
    const tags = await Article_1.default.find().distinct('tagList').exec();
    res.status(200).json({
        tags
    });
});
exports.getTags = getTags;
//# sourceMappingURL=tagsController.js.map