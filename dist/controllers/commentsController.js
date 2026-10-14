"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.getCommentsFromArticle = exports.addCommentsToArticle = void 0;
const Article_1 = __importDefault(require("../models/Article"));
const User_1 = __importDefault(require("../models/User"));
const Comment_1 = __importDefault(require("../models/Comment"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const addCommentsToArticle = (0, express_async_handler_1.default)(async (req, res) => {
    const userId = req.userId;
    const commenter = await User_1.default.findById(userId).exec();
    if (!commenter) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }
    const { slug } = req.params;
    const article = await Article_1.default.findOne({ slug }).exec();
    if (!article) {
        res.status(404).json({ message: 'Article Not Found' });
        return;
    }
    const { body } = req.body.comment;
    const newComment = await Comment_1.default.create({
        body,
        author: commenter._id,
        article: article._id
    });
    await article.addComment(newComment._id);
    res.status(201).json({
        comment: await newComment.toCommentResponse(commenter)
    });
});
exports.addCommentsToArticle = addCommentsToArticle;
const getCommentsFromArticle = (0, express_async_handler_1.default)(async (req, res) => {
    const { slug } = req.params;
    const article = await Article_1.default.findOne({ slug }).exec();
    if (!article) {
        res.status(404).json({ message: 'Article Not Found' });
        return;
    }
    let user = false;
    if (req.loggedin && req.userId) {
        user = (await User_1.default.findById(req.userId).exec()) ?? false;
    }
    res.status(200).json({
        comments: await Promise.all(article.comments.map(async (commentId) => {
            const commentObj = await Comment_1.default.findById(commentId).exec();
            return await commentObj?.toCommentResponse(user);
        }))
    });
});
exports.getCommentsFromArticle = getCommentsFromArticle;
const deleteComment = (0, express_async_handler_1.default)(async (req, res) => {
    const userId = req.userId;
    const commenter = await User_1.default.findById(userId).exec();
    if (!commenter) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }
    const { slug, id } = req.params;
    const article = await Article_1.default.findOne({ slug }).exec();
    if (!article) {
        res.status(404).json({ message: 'Article Not Found' });
        return;
    }
    const comment = await Comment_1.default.findById(id).exec();
    if (!comment) {
        res.status(404).json({ message: 'Comment Not Found' });
        return;
    }
    if (comment.author.toString() === commenter._id.toString()) {
        await article.removeComment(comment._id);
        await Comment_1.default.deleteOne({ _id: comment._id });
        res.status(200).json({ message: 'Comment successfully deleted' });
    }
    else {
        res.status(403).json({ message: 'Only the author can delete their comment' });
    }
});
exports.deleteComment = deleteComment;
//# sourceMappingURL=commentsController.js.map