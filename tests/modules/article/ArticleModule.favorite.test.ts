import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleModule } from '@/src/modules/article/ArticleModule';
import User from '@/models/User';
import Article from '@/models/Article';
import type { IUser } from '@/models/User';
import type { IArticle } from '@/models/Article';
import { UnauthorizedError, NotFoundError } from '@/src/shared/errors/AppError';
import mongoose from 'mongoose';

describe('ArticleModule.favorite', () => {
    let user: IUser;
    let article: IArticle;

    beforeEach(async () => {
        user = await new User({
            username: 'testuser',
            email: 'user@example.com',
            password: 'password123',
            bio: 'Test bio',
            image: 'https://example.com/user.jpg',
        }).save();

        article = await new Article({
            title: 'Test Article',
            description: 'Test description',
            body: 'Test body content',
            tagList: ['tag1', 'tag2'],
            author: user._id,
        }).save();
    });

    const expectArticleResponseShape = (article: any) => {
        expect(article).toHaveProperty('slug');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('description');
        expect(article).toHaveProperty('body');
        expect(article).toHaveProperty('tagList');
        expect(Array.isArray(article.tagList)).toBe(true);
        expect(article).toHaveProperty('favorited');
        expect(typeof article.favorited).toBe('boolean');
        expect(article).toHaveProperty('favoritesCount');
        expect(typeof article.favoritesCount).toBe('number');
        expect(article).toHaveProperty('createdAt');
        expect(article).toHaveProperty('updatedAt');
        expect(article.author).toHaveProperty('username');
        expect(article.author).toHaveProperty('bio');
        expect(article.author).toHaveProperty('image');
        expect(article.author).toHaveProperty('following');
        expect(typeof article.author.following).toBe('boolean');
    };

    it('throws UnauthorizedError when user not found', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();

        await expect(ArticleModule.favorite(nonExistentId, article.slug))
            .rejects.toThrow(UnauthorizedError);
    });

    it('throws NotFoundError when article does not exist', async () => {
        await expect(ArticleModule.favorite(user._id.toString(), 'non-existent-slug'))
            .rejects.toThrow(NotFoundError);
    });

    it('returns updated ArticleResponse with favorited=true and incremented favoritesCount', async () => {
        const originalCount = article.favouritesCount;
        const result = await ArticleModule.favorite(user._id.toString(), article.slug);

        expect(result.favorited).toBe(true);
        expect(result.favoritesCount).toBe(originalCount + 1);
        expectArticleResponseShape(result);
    });

    it('increments favoritesCount in database', async () => {
        const originalCount = article.favouritesCount;

        await ArticleModule.favorite(user._id.toString(), article.slug);

        const updated = await Article.findById(article._id).exec();
        expect(updated?.favouritesCount).toBe(originalCount + 1);
    });

    it('adds article to user favouriteArticles array', async () => {
        await ArticleModule.favorite(user._id.toString(), article.slug);

        const updatedUser = await User.findById(user._id).exec();
        expect(updatedUser?.favouriteArticles.some(id => id.equals(article._id))).toBe(true);
    });

    it('is idempotent - favoriting already favorited article does not increment count', async () => {
        // First favorite
        await ArticleModule.favorite(user._id.toString(), article.slug);
        const afterFirst = await Article.findById(article._id).exec();
        const countAfterFirst = afterFirst?.favouritesCount ?? 0;

        // Second favorite (should be idempotent)
        const result = await ArticleModule.favorite(user._id.toString(), article.slug);

        expect(result.favorited).toBe(true);
        expect(result.favoritesCount).toBe(countAfterFirst);

        const afterSecond = await Article.findById(article._id).exec();
        expect(afterSecond?.favouritesCount).toBe(countAfterFirst);
    });

    it('returns favorited=true in response when article already favorited', async () => {
        await ArticleModule.favorite(user._id.toString(), article.slug);
        const result = await ArticleModule.favorite(user._id.toString(), article.slug);

        expect(result.favorited).toBe(true);
    });

    it('works when user is also the author', async () => {
        const result = await ArticleModule.favorite(user._id.toString(), article.slug);

        expect(result.favorited).toBe(true);
        expect(result.favoritesCount).toBe(1);
        expect(result.author.username).toBe(user.username);
    });

    it('increments count correctly with multiple users favoriting', async () => {
        const user2 = await new User({
            username: 'user2',
            email: 'user2@example.com',
            password: 'password123',
        }).save();

        const user3 = await new User({
            username: 'user3',
            email: 'user3@example.com',
            password: 'password123',
        }).save();

        await ArticleModule.favorite(user._id.toString(), article.slug);
        await ArticleModule.favorite(user2._id.toString(), article.slug);
        await ArticleModule.favorite(user3._id.toString(), article.slug);

        const updated = await Article.findById(article._id).exec();
        expect(updated?.favouritesCount).toBe(3);
    });
});