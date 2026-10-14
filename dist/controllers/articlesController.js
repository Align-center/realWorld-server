"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listArticles = exports.feedArticles = exports.updateArticle = exports.getArticleWithSlug = exports.unfavoriteArticle = exports.favoriteArticle = exports.deleteArticle = exports.createArticle = void 0;
const Article_1 = __importDefault(require("../models/Article"));
const User_1 = __importDefault(require("../models/User"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const createArticle = (0, express_async_handler_1.default)(async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const author = await User_1.default.findById(userId).exec();
    if (!author) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }
    const { title, description, body, tagList } = req.body.article;
    // confirm data
    if (!title || !description || !body) {
        res.status(400).json({ message: 'All fields are required' });
        return;
    }
    const article = await Article_1.default.create({
        title,
        description,
        body,
        author: userId,
        tagList: Array.isArray(tagList) && tagList.length > 0 ? tagList : []
    });
    await article.save();
    res.status(201).json({
        article: await article.toArticleResponse(author)
    });
});
exports.createArticle = createArticle;
const deleteArticle = (0, express_async_handler_1.default)(async (req, res) => {
    const userId = req.userId;
    const { slug } = req.params;
    const loginUser = await User_1.default.findById(userId).exec();
    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }
    const article = await Article_1.default.findOne({ slug }).exec();
    if (!article) {
        res.status(404).json({ message: 'Article Not Found' });
        return;
    }
    if (article.author.toString() === loginUser._id.toString()) {
        await Article_1.default.deleteOne({ slug });
        res.status(200).json({ message: 'Article successfully deleted!!!' });
    }
    else {
        res.status(403).json({ message: 'Only the author can delete their article' });
    }
});
exports.deleteArticle = deleteArticle;
const favoriteArticle = (0, express_async_handler_1.default)(async (req, res) => {
    const userId = req.userId;
    const { slug } = req.params;
    const loginUser = await User_1.default.findById(userId).exec();
    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }
    const article = await Article_1.default.findOne({ slug }).exec();
    if (!article) {
        res.status(404).json({ message: 'Article Not Found' });
        return;
    }
    await loginUser.favorite(article._id);
    const updatedArticle = await article.updateFavoriteCount();
    res.status(200).json({
        article: await updatedArticle.toArticleResponse(loginUser)
    });
});
exports.favoriteArticle = favoriteArticle;
const unfavoriteArticle = (0, express_async_handler_1.default)(async (req, res) => {
    const userId = req.userId;
    const { slug } = req.params;
    const loginUser = await User_1.default.findById(userId).exec();
    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }
    const article = await Article_1.default.findOne({ slug }).exec();
    if (!article) {
        res.status(404).json({ message: 'Article Not Found' });
        return;
    }
    await loginUser.unfavorite(article._id);
    await article.updateFavoriteCount();
    res.status(200).json({
        article: await article.toArticleResponse(loginUser)
    });
});
exports.unfavoriteArticle = unfavoriteArticle;
const getArticleWithSlug = (0, express_async_handler_1.default)(async (req, res) => {
    const { slug } = req.params;
    const article = await Article_1.default.findOne({ slug }).exec();
    if (!article) {
        res.status(404).json({ message: 'Article Not Found' });
        return;
    }
    const user = req.loggedin ? (await User_1.default.findById(req.userId).exec()) ?? false : false;
    res.status(200).json({
        article: await article.toArticleResponse(user)
    });
});
exports.getArticleWithSlug = getArticleWithSlug;
const updateArticle = (0, express_async_handler_1.default)(async (req, res) => {
    const userId = req.userId;
    const { article: articleData } = req.body;
    const { slug } = req.params;
    const loginUser = await User_1.default.findById(userId).exec();
    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }
    const article = await Article_1.default.findOne({ slug }).exec();
    if (!article) {
        res.status(404).json({ message: 'Article Not Found' });
        return;
    }
    if (articleData.title) {
        article.title = articleData.title;
    }
    if (articleData.description) {
        article.description = articleData.description;
    }
    if (articleData.body) {
        article.body = articleData.body;
    }
    if (articleData.tagList) {
        article.tagList = articleData.tagList;
    }
    await article.save();
    res.status(200).json({
        article: await article.toArticleResponse(loginUser)
    });
});
exports.updateArticle = updateArticle;
const feedArticles = (0, express_async_handler_1.default)(async (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const userId = req.userId;
    const loginUser = await User_1.default.findById(userId).exec();
    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }
    const filteredArticles = await Article_1.default.find({ author: { $in: loginUser.followingUsers } })
        .limit(limit)
        .skip(offset)
        .exec();
    const articleCount = await Article_1.default.countDocuments({ author: { $in: loginUser.followingUsers } });
    res.status(200).json({
        articles: await Promise.all(filteredArticles.map(async (article) => {
            return await article.toArticleResponse(loginUser);
        })),
        articlesCount: articleCount
    });
});
exports.feedArticles = feedArticles;
const listArticles = (0, express_async_handler_1.default)(async (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const query = {};
    if (req.query.tag) {
        query.tagList = { $in: [req.query.tag] };
    }
    if (req.query.author) {
        const author = await User_1.default.findOne({ username: req.query.author }).exec();
        if (author) {
            query.author = author._id;
        }
    }
    if (req.query.favorited) {
        const favoriter = await User_1.default.findOne({ username: req.query.favorited }).exec();
        if (favoriter) {
            query._id = { $in: favoriter.favouriteArticles };
        }
    }
    const filteredArticles = await Article_1.default.find(query)
        .limit(limit)
        .skip(offset)
        .sort({ createdAt: 'desc' })
        .exec();
    const articleCount = await Article_1.default.countDocuments(query);
    let user = false;
    if (req.loggedin && req.userId) {
        user = await User_1.default.findById(req.userId).exec() || false;
    }
    res.status(200).json({
        articles: await Promise.all(filteredArticles.map(async (article) => {
            return await article.toArticleResponse(user);
        })),
        articlesCount: articleCount
    });
});
exports.listArticles = listArticles;
//# sourceMappingURL=articlesController.js.map