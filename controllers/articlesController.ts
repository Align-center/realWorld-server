import Article, { IArticle } from '../models/Article';
import User, { IUser } from '../models/User';
import asyncHandler from 'express-async-handler';
import { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
    userId?: string;
    userEmail?: string;
    userHashedPwd?: string;
    loggedin?: boolean;
}

interface ArticleRequestBody {
    article: {
        title: string;
        description: string;
        body: string;
        tagList?: string[];
    };
}

const createArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.userId;

    const author = await User.findById(id).exec();

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

    const article = await Article.create({ title, description, body });

    article.author = id as any;

    if (Array.isArray(tagList) && tagList.length > 0) {
        article.tagList = tagList;
    }

    await article.save();

    res.status(200).json({
        article: await article.toArticleResponse(author)
    });
});

const deleteArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.userId;
    const { slug } = req.params;

    const loginUser = await User.findById(id).exec();

    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        res.status(401).json({ message: 'Article Not Found' });
        return;
    }

    if (article.author.toString() === loginUser._id.toString()) {
        await Article.deleteOne({ slug });
        res.status(200).json({ message: 'Article successfully deleted!!!' });
    } else {
        res.status(403).json({ message: 'Only the author can delete his article' });
    }
});

const favoriteArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.userId;
    const { slug } = req.params;

    const loginUser = await User.findById(id).exec();

    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        res.status(401).json({ message: 'Article Not Found' });
        return;
    }

    await loginUser.favorite(article._id);

    const updatedArticle = await article.updateFavoriteCount();

    res.status(200).json({
        article: await updatedArticle.toArticleResponse(loginUser)
    });
});

const unfavoriteArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.userId;
    const { slug } = req.params;

    const loginUser = await User.findById(id).exec();

    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        res.status(401).json({ message: 'Article Not Found' });
        return;
    }

    await loginUser.unfavorite(article._id);

    await article.updateFavoriteCount();

    res.status(200).json({
        article: await article.toArticleResponse(loginUser)
    });
});

const getArticleWithSlug = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { slug } = req.params;

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        res.status(401).json({ message: 'Article Not Found' });
        return;
    }

    res.status(200).json({
        article: await article.toArticleResponse(false)
    });
});

const updateArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { article: articleData } = req.body as ArticleRequestBody;
    const { slug } = req.params;

    const loginUser = await User.findById(userId).exec();

    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }

    const target = await Article.findOne({ slug }).exec();

    if (!target) {
        res.status(401).json({ message: 'Article Not Found' });
        return;
    }

    if (articleData.title) {
        target.title = articleData.title;
    }
    if (articleData.description) {
        target.description = articleData.description;
    }
    if (articleData.body) {
        target.body = articleData.body;
    }
    if (articleData.tagList) {
        target.tagList = articleData.tagList;
    }

    await target.save();

    res.status(200).json({
        article: await target.toArticleResponse(loginUser)
    });
});

const feedArticles = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let limit = 20;
    let offset = 0;

    if (req.query.limit) {
        limit = Number(req.query.limit);
    }

    if (req.query.offset) {
        offset = Number(req.query.offset);
    }

    const userId = req.userId;

    const loginUser = await User.findById(userId).exec();

    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
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
    let limit = 20;
    let offset = 0;
    const query: any = {};

    if (req.query.limit) {
        limit = Number(req.query.limit);
    }

    if (req.query.offset) {
        offset = Number(req.query.offset);
    }
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

    if (req.loggedin) {
        const loginUser = await User.findById(req.userId).exec();
        if (!loginUser) {
            res.status(401).json({ message: 'User Not Found' });
            return;
        }
        res.status(200).json({
            articles: await Promise.all(filteredArticles.map(async (article) => {
                return await article.toArticleResponse(loginUser);
            })),
            articlesCount: articleCount
        });
    } else {
        res.status(200).json({
            articles: await Promise.all(filteredArticles.map(async (article) => {
                return await article.toArticleResponse(false);
            })),
            articlesCount: articleCount
        });
    }
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