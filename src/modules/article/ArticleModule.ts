import Article from '@/models/Article';
import User from '@/models/User';
import Comment from '@/models/Comment';
import type { IUser } from '@/models/User';
import type mongoose from 'mongoose';
import { NotFoundError, ForbiddenError, UnauthorizedError, ValidationError } from '../../shared/errors/AppError';

export interface CreateArticleInput {
    title: string;
    description: string;
    body: string;
    tagList?: string[];
}

export interface UpdateArticleInput {
    title?: string;
    description?: string;
    body?: string;
    tagList?: string[];
}

export interface ListArticlesQuery {
    tag?: string;
    author?: string;
    favorited?: string;
    limit?: number;
    offset?: number;
}

export interface ArticleResponse {
    slug: string;
    title: string;
    description: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
    tagList: string[];
    favorited: boolean;
    favoritesCount: number;
    author: {
        username: string;
        bio: string;
        image: string;
        following: boolean;
    };
}

export interface ArticlesListResponse {
    articles: ArticleResponse[];
    articlesCount: number;
}

export interface CommentResponse {
    id: mongoose.Types.ObjectId;
    body: string;
    createdAt: Date;
    updatedAt: Date;
    author: {
        username: string;
        bio: string;
        image: string;
        following: boolean;
    };
}

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;
const REQUIRED_CREATE_FIELDS = ['title', 'description', 'body'] as const;

/**
 * Finds a user by ID or throws UnauthorizedError.
 */
async function getUserOrThrow(userId: string): Promise<IUser> {
    const user = await User.findById(userId).exec();
    if (!user) {
        throw new UnauthorizedError('User Not Found');
    }
    return user;
}

/**
 * Finds an article by slug or throws NotFoundError.
 */
async function getArticleOrThrow(slug: string) {
    const article = await Article.findOne({ slug }).exec();
    if (!article) {
        throw new NotFoundError('Article Not Found');
    }
    return article;
}

/**
 * Builds the filter query for getList based on query parameters.
 */
async function buildArticleFilter(query: ListArticlesQuery): Promise<mongoose.FilterQuery<typeof Article>> {
    const filter: mongoose.FilterQuery<typeof Article> = {};

    if (query.tag) {
        filter.tagList = { $in: [query.tag] };
    }

    if (query.author) {
        const author = await User.findOne({ username: query.author }).exec();
        if (author) {
            filter.author = author._id;
        }
    }

    if (query.favorited) {
        const favoriter = await User.findOne({ username: query.favorited }).exec();
        if (favoriter) {
            filter._id = { $in: favoriter.favouriteArticles };
        }
    }

    return filter;
}

/**
 * ArticleModule encapsulates all article-related business logic.
 * Provides a clean interface for article operations without HTTP concerns.
 */
export const ArticleModule = {
    /**
     * Create a new article
     * @param authorId - The ID of the user creating the article
     * @param input - Article data (title, description, body, tagList)
     * @returns The created article response
     * @throws UnauthorizedError if author not found
     * @throws ValidationError if required fields are missing
     */
    async create(authorId: string, input: CreateArticleInput): Promise<ArticleResponse> {
        const author = await getUserOrThrow(authorId);

        const missingFields = REQUIRED_CREATE_FIELDS.filter((field) => !input[field]);

        if (missingFields.length > 0) {
            const fieldErrors: Record<string, string[]> = {};
            for (const field of missingFields) {
                fieldErrors[field] = [`${field} is required`];
            }
            throw new ValidationError('Validation failed', fieldErrors);
        }

        const { title, description, body, tagList } = input;

        const article = await Article.create({
            title,
            description,
            body,
            author: authorId,
            tagList: Array.isArray(tagList) && tagList.length > 0 ? tagList : [],
        });

        return article.toArticleResponse(author);
    },

    /**
     * Get an article by slug
     * @param slug - The article slug
     * @param viewer - Optional viewer user for favorited/following status
     * @returns The article response
     * @throws NotFoundError if article not found
     */
    async getBySlug(slug: string, viewer: IUser | false = false): Promise<ArticleResponse> {
        const article = await getArticleOrThrow(slug);
        return article.toArticleResponse(viewer);
    },

    /**
     * Get a list of articles with optional filters
     * @param query - Filter options (tag, author, favorited, limit, offset)
     * @param viewer - Optional viewer user for favorited/following status
     * @returns Paginated list of articles with count
     */
    async getList(query: ListArticlesQuery, viewer: IUser | false = false): Promise<ArticlesListResponse> {
        const limit = query.limit ?? DEFAULT_LIMIT;
        const offset = query.offset ?? DEFAULT_OFFSET;

        const filter = await buildArticleFilter(query);

        const [articles, articlesCount] = await Promise.all([
            Article.find(filter)
                .limit(limit)
                .skip(offset)
                .sort({ createdAt: 'desc' })
                .exec(),
            Article.countDocuments(filter)
        ]);

        const articleResponses = await Promise.all(
            articles.map((article) => article.toArticleResponse(viewer))
        );

        return { articles: articleResponses, articlesCount };
    },

    /**
     * Get feed of articles from followed authors
     * @param userId - The ID of the user requesting the feed
     * @param limit - Maximum number of articles to return
     * @param offset - Number of articles to skip
     * @returns Paginated list of articles from followed authors with count
     * @throws UnauthorizedError if user not found
     */
    async getFeed(userId: string, limit: number = DEFAULT_LIMIT, offset: number = DEFAULT_OFFSET): Promise<ArticlesListResponse> {
        const loginUser = await getUserOrThrow(userId);

        const [articles, articlesCount] = await Promise.all([
            Article.find({ author: { $in: loginUser.followingUsers } })
                .limit(limit)
                .skip(offset)
                .sort({ createdAt: 'desc' })
                .exec(),
            Article.countDocuments({ author: { $in: loginUser.followingUsers } })
        ]);

        const articleResponses = await Promise.all(
            articles.map((article) => article.toArticleResponse(loginUser))
        );

        return { articles: articleResponses, articlesCount };
    },

    /**
     * Update an article
     * @param userId - The ID of the user attempting the update
     * @param slug - The slug of the article to update
     * @param input - Fields to update (title, description, body, tagList)
     * @returns The updated article response
     * @throws UnauthorizedError if user not found
     * @throws NotFoundError if article not found
     * Note: Current behavior allows any authenticated user to update (no author check)
     */
    async update(userId: string, slug: string, input: UpdateArticleInput): Promise<ArticleResponse> {
        const loginUser = await getUserOrThrow(userId);
        const article = await getArticleOrThrow(slug);

        if (input.title !== undefined) {
            article.title = input.title;
        }
        if (input.description !== undefined) {
            article.description = input.description;
        }
        if (input.body !== undefined) {
            article.body = input.body;
        }
        if (input.tagList !== undefined) {
            article.tagList = input.tagList;
        }

        await article.save();

        return article.toArticleResponse(loginUser);
    },

    /**
     * Delete an article (author only)
     * @param userId - The ID of the user attempting the deletion
     * @param slug - The slug of the article to delete
     * @returns Success message
     * @throws UnauthorizedError if user not found
     * @throws NotFoundError if article not found
     * @throws ForbiddenError if user is not the author
     */
    async delete(userId: string, slug: string): Promise<{ message: string }> {
        const loginUser = await getUserOrThrow(userId);
        const article = await getArticleOrThrow(slug);

        if (article.author.toString() !== loginUser._id.toString()) {
            throw new ForbiddenError('Only the author can delete their article');
        }

        await Article.deleteOne({ slug });

        return { message: 'Article successfully deleted!!!' };
    },

    /**
     * Favorite an article
     * @param userId - The ID of the user favoriting the article
     * @param slug - The slug of the article to favorite
     * @returns The updated article response with favorited=true and incremented count
     * @throws UnauthorizedError if user not found
     * @throws NotFoundError if article not found
     */
    async favorite(userId: string, slug: string): Promise<ArticleResponse> {
        const loginUser = await getUserOrThrow(userId);
        const article = await getArticleOrThrow(slug);

        await loginUser.favorite(article._id);
        const updatedArticle = await article.updateFavoriteCount();

        return updatedArticle.toArticleResponse(loginUser);
    },

    /**
     * Unfavorite an article
     * @param userId - The ID of the user unfavoriting the article
     * @param slug - The slug of the article to unfavorite
     * @returns The updated article response with favorited=false and decremented count
     * @throws UnauthorizedError if user not found
     * @throws NotFoundError if article not found
     */
    async unfavorite(userId: string, slug: string): Promise<ArticleResponse> {
        const loginUser = await getUserOrThrow(userId);
        const article = await getArticleOrThrow(slug);

        await loginUser.unfavorite(article._id);
        await article.updateFavoriteCount();

        return article.toArticleResponse(loginUser);
    },

    /**
     * Add a comment to an article
     * @param userId - The ID of the user adding the comment
     * @param slug - The slug of the article to comment on
     * @param body - The comment body text
     * @returns The created comment response
     * @throws UnauthorizedError if user not found
     * @throws NotFoundError if article not found
     */
    async addComment(userId: string, slug: string, body: string): Promise<CommentResponse> {
        const commenter = await getUserOrThrow(userId);
        const article = await getArticleOrThrow(slug);

        const newComment = await Comment.create({
            body,
            author: commenter._id,
            article: article._id,
        });

        await article.addComment(newComment._id);

        return newComment.toCommentResponse(commenter);
    }
};

export default ArticleModule;
