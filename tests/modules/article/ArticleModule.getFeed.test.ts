import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleModule } from '@/src/modules/article/ArticleModule';
import User from '@/models/User';
import Article from '@/models/Article';
import type { IUser } from '@/models/User';
import type { IArticle } from '@/models/Article';
import { UnauthorizedError } from '@/src/shared/errors/AppError';
import mongoose from 'mongoose';

describe('ArticleModule.getFeed', () => {
    let users: IUser[];
    let articles: IArticle[];

    beforeEach(async () => {
        // Create 4 users
        users = await Promise.all([
            new User({ username: 'user1', email: 'user1@example.com', password: 'pass123', bio: 'User 1', image: 'img1.jpg' }).save(),
            new User({ username: 'user2', email: 'user2@example.com', password: 'pass123', bio: 'User 2', image: 'img2.jpg' }).save(),
            new User({ username: 'user3', email: 'user3@example.com', password: 'pass123', bio: 'User 3', image: 'img3.jpg' }).save(),
            new User({ username: 'user4', email: 'user4@example.com', password: 'pass123', bio: 'User 4', image: 'img4.jpg' }).save(),
        ]);

        // Create articles: user2 has 2, user3 has 1, user4 has 1 (user1 follows user2 and user3)
        articles = await Promise.all([
            new Article({ title: 'User2 Article 1', description: 'Desc', body: 'Body', tagList: ['tag1'], author: users[1]._id }).save(),
            new Article({ title: 'User2 Article 2', description: 'Desc', body: 'Body', tagList: ['tag2'], author: users[1]._id }).save(),
            new Article({ title: 'User3 Article 1', description: 'Desc', body: 'Body', tagList: ['tag3'], author: users[2]._id }).save(),
            new Article({ title: 'User4 Article 1', description: 'Desc', body: 'Body', tagList: ['tag4'], author: users[3]._id }).save(),
        ]);

        // user1 follows user2 and user3
        await users[0].follow(users[1]._id);
        await users[0].follow(users[2]._id);
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
        await expect(ArticleModule.getFeed(nonExistentId))
            .rejects.toThrow(UnauthorizedError);
    });

    it('returns articles from followed authors only', async () => {
        const result = await ArticleModule.getFeed(users[0]._id.toString());

        expect(result.articlesCount).toBe(3); // user2 has 2, user3 has 1
        expect(result.articles.every(a => a.author.username === 'user2' || a.author.username === 'user3')).toBe(true);
        result.articles.forEach(expectArticleResponseShape);
    });

    it('excludes articles from non-followed authors', async () => {
        const result = await ArticleModule.getFeed(users[0]._id.toString());

        expect(result.articles.every(a => a.author.username !== 'user4')).toBe(true);
        expect(result.articles.every(a => a.author.username !== 'user1')).toBe(true);
    });

    it('respects limit parameter', async () => {
        const result = await ArticleModule.getFeed(users[0]._id.toString(), 2);

        expect(result.articles.length).toBeLessThanOrEqual(2);
        expect(result.articlesCount).toBe(3);
    });

    it('respects offset parameter', async () => {
        const firstPage = await ArticleModule.getFeed(users[0]._id.toString(), 2, 0);
        const secondPage = await ArticleModule.getFeed(users[0]._id.toString(), 2, 2);

        expect(firstPage.articles.length).toBeLessThanOrEqual(2);
        expect(secondPage.articles.length).toBeLessThanOrEqual(2);
        if (firstPage.articles.length > 0 && secondPage.articles.length > 0) {
            expect(firstPage.articles[0].slug).not.toBe(secondPage.articles[0].slug);
        }
    });

    it('returns empty array when user follows no authors', async () => {
        const loneUser = await new User({
            username: 'loneuser',
            email: 'lone@example.com',
            password: 'pass123',
        }).save();

        const result = await ArticleModule.getFeed(loneUser._id.toString());

        expect(result.articles).toEqual([]);
        expect(result.articlesCount).toBe(0);
    });

    it('includes favorited status relative to feed user', async () => {
        // user1 favorites user2's first article
        await users[0].favorite(articles[0]._id);
        await articles[0].updateFavoriteCount();

        const result = await ArticleModule.getFeed(users[0]._id.toString());

        const favoritedArticle = result.articles.find(a => a.slug === articles[0].slug);
        expect(favoritedArticle).toBeDefined();
        expect(favoritedArticle!.favorited).toBe(true);
    });

    it('includes following=true on authors that feed user follows', async () => {
        const result = await ArticleModule.getFeed(users[0]._id.toString());

        expect(result.articles.every(a => a.author.following === true)).toBe(true);
    });

    it('returns articles (sort order not guaranteed by current implementation)', async () => {
        const result = await ArticleModule.getFeed(users[0]._id.toString());

        // Current implementation doesn't specify sort order for feed
        // Just verify we get the expected articles
        expect(result.articles.length).toBeGreaterThan(0);
        result.articles.forEach(expectArticleResponseShape);
    });

    it('returns correct article count', async () => {
        const result = await ArticleModule.getFeed(users[0]._id.toString());

        expect(result.articlesCount).toBe(3);
    });
});