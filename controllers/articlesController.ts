import Article from '../models/Article';
import User, { IUser } from '../models/User';
import asyncHandler from 'express-async-handler';
import { Response } from 'express';
import { AuthenticatedRequest, ArticleRequestBody } from '../types/express';
import mongoose from 'mongoose';
import { ArticleModule } from '../src/modules/article/ArticleModule';
import { NotFoundError, ForbiddenError, UnauthorizedError, ValidationError } from '../src/shared/errors/AppError';

const createArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
        throw new UnauthorizedError();
    }

    const author = await User.findById(userId).exec();

    if (!author) {
        throw new UnauthorizedError('User Not Found');
    }

    const { title, description, body, tagList } = req.body.article;

    // confirm data
    const missingFields: string[] = [];
    if (!title) missingFields.push('title');
    if (!description) missingFields.push('description');
    if (!body) missingFields.push('body');

    if (missingFields.length > 0) {
        const fieldErrors: Record<string, string[]> = {};
        for (const field of missingFields) {
            fieldErrors[field] = [`${field} is required`];
        }
        throw new ValidationError('Validation failed', fieldErrors);
    }

    const article = await Article.create({
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

const deleteArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { slug } = req.params;

    const loginUser = await User.findById(userId).exec();

    if (!loginUser) {
        throw new UnauthorizedError('User Not Found');
    }

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        throw new NotFoundError('Article Not Found');
    }

    if (article.author.toString() === loginUser._id.toString()) {
        await Article.deleteOne({ slug });
        res.status(200).json({ message: 'Article successfully deleted!!!' });
    } else {
        throw new ForbiddenError('Only the author can delete their article');
    }
});

const favoriteArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { slug } = req.params;

    const loginUser = await User.findById(userId).exec();

    if (!loginUser) {
        throw new UnauthorizedError('User Not Found');
    }

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        throw new NotFoundError('Article Not Found');
    }

    await loginUser.favorite(article._id);

    const updatedArticle = await article.updateFavoriteCount();

    res.status(200).json({
        article: await updatedArticle.toArticleResponse(loginUser)
    });
});

const unfavoriteArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { slug } = req.params;

    const loginUser = await User.findById(userId).exec();

    if (!loginUser) {
        throw new UnauthorizedError('User Not Found');
    }

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        throw new NotFoundError('Article Not Found');
    }

    await loginUser.unfavorite(article._id);

    await article.updateFavoriteCount();

    res.status(200).json({
        article: await article.toArticleResponse(loginUser)
    });
});

const getArticleWithSlug = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { slug } = req.params;
    const slugStr = Array.isArray(slug) ? slug[0] : slug;

    const viewer: IUser | false = req.loggedin && req.userId
        ? (await User.findById(req.userId).exec()) ?? false
        : false;

    const article = await ArticleModule.getBySlug(slugStr, viewer);

    res.status(200).json({ article });
});

const updateArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { article: articleData } = req.body as ArticleRequestBody;
    const { slug } = req.params;

    const loginUser = await User.findById(userId).exec();

    if (!loginUser) {
        throw new UnauthorizedError('User Not Found');
    }

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        throw new NotFoundError('Article Not Found');
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

const feedArticles = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;

    const userId = req.userId;

    const loginUser = await User.findById(userId).exec();

    if (!loginUser) {
        throw new UnauthorizedError('User Not Found');
    }

    const filteredArticles = await Article.find({ author: { $in: loginUser.followingUsers } })
        .limit(limit)
        .skip(offset)
        .exec();

    const articleCount = await Article.countDocuments({ author: { $in: loginUser.followingUsers } });

    res.status(200).json({
        articles: await Promise.all(filteredArticles.map(async (article) => {
            return await article.toArticleResponse(loginUser);
        })),
        articlesCount: articleCount
    });
});

const listArticles = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const query: mongoose.FilterQuery<typeof Article> = {};

    if (req.query.tag) {
        query.tagList = { $in: [req.query.tag] };
    }

    if (req.query.author) {
        const author = await User.findOne({ username: req.query.author }).exec();
        if (author) {
            query.author = author._id;
        }
    }

    if (req.query.favorited) {
        const favoriter = await User.findOne({ username: req.query.favorited }).exec();
        if (favoriter) {
            query._id = { $in: favoriter.favouriteArticles };
        }
    }

    const filteredArticles = await Article.find(query)
        .limit(limit)
        .skip(offset)
        .sort({ createdAt: 'desc' })
        .exec();

    const articleCount = await Article.countDocuments(query);

    let user: IUser | false = false;
    if (req.loggedin && req.userId) {
        user = await User.findById(req.userId).exec() || false;
    }

    res.status(200).json({
        articles: await Promise.all(filteredArticles.map(async (article) => {
            return await article.toArticleResponse(user);
        })),
        articlesCount: articleCount
    });
});

export {
    createArticle,
    deleteArticle,
    favoriteArticle,
    unfavoriteArticle,
    getArticleWithSlug,
    updateArticle,
    feedArticles,
    listArticles
};
