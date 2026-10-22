import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleModule } from '@/src/modules/article/ArticleModule';
import User from '@/models/User';
import Article from '@/models/Article';
import type { IUser } from '@/models/User';
import type { IArticle } from '@/models/Article';
import type { ListArticlesQuery } from '@/src/modules/article/ArticleModule';
import mongoose from 'mongoose';

describe('ArticleModule.getList', () => {
    let users: IUser[];
    let articles: IArticle[];

    beforeEach(async () => {
        // Create 3 users
        users = await Promise.all([
            new User({ username: 'user1', email: 'user1@example.com', password: 'pass123', bio: 'User 1', image: 'img1.jpg' }).save(),
            new User({ username: 'user2', email: 'user2@example.com', password: 'pass123', bio: 'User 2', image: 'img2.jpg' }).save(),
            new User({ username: 'user3', email: 'user3@example.com', password: 'pass123', bio: 'User 3', image: 'img3.jpg' }).save(),
        ]);

        // Create articles: user1 has 3, user2 has 2, user3 has 1
        articles = await Promise.all([
            new Article({ title: 'User1 Article 1', description: 'Desc', body: 'Body', tagList: ['tag1', 'tag2'], author: users[0]._id }).save(),
            new Article({ title: 'User1 Article 2', description: 'Desc', body: 'Body', tagList: ['tag2', 'tag3'], author: users[0]._id }).save(),
            new Article({ title: 'User1 Article 3', description: 'Desc', body: 'Body', tagList: ['tag1'], author: users[0]._id }).save(),
            new Article({ title: 'User2 Article 1', description: 'Desc', body: 'Body', tagList: ['tag3', 'tag4'], author: users[1]._id }).save(),
            new Article({ title: 'User2 Article 2', description: 'Desc', body: 'Body', tagList: ['tag1'], author: users[1]._id }).save(),
            new Article({ title: 'User3 Article 1', description: 'Desc', body: 'Body', tagList: ['tag4'], author: users[2]._id }).save(),
        ]);

        // Set up favorites: user1 favorites user2's first article
        await users[0].favorite(articles[3]._id);
        await articles[3].updateFavoriteCount();

        // Set up follows: user1 follows user2
        await users[0].follow(users[1]._id);
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

    it('returns paginated articles with default limit and offset', async () => {
        const query: ListArticlesQuery = {};
        const result = await ArticleModule.getList(query);

        expect(result).toHaveProperty('articles');
        expect(result).toHaveProperty('articlesCount');
        expect(Array.isArray(result.articles)).toBe(true);
        expect(result.articles.length).toBeLessThanOrEqual(20); // default limit
        expect(result.articlesCount).toBe(6);
        result.articles.forEach(expectArticleResponseShape);
    });

    it('respects limit parameter', async () => {
        const query: ListArticlesQuery = { limit: 2 };
        const result = await ArticleModule.getList(query);

        expect(result.articles.length).toBeLessThanOrEqual(2);
        expect(result.articlesCount).toBe(6);
    });

    it('respects offset parameter', async () => {
        const firstPage = await ArticleModule.getList({ limit: 2, offset: 0 });
        const secondPage = await ArticleModule.getList({ limit: 2, offset: 2 });

        expect(firstPage.articles.length).toBeLessThanOrEqual(2);
        expect(secondPage.articles.length).toBeLessThanOrEqual(2);
        if (firstPage.articles.length > 0 && secondPage.articles.length > 0) {
            expect(firstPage.articles[0].slug).not.toBe(secondPage.articles[0].slug);
        }
    });

    it('filters by tag', async () => {
        const query: ListArticlesQuery = { tag: 'tag1' };
        const result = await ArticleModule.getList(query);

        expect(result.articles.every(a => a.tagList.includes('tag1'))).toBe(true);
        expect(result.articlesCount).toBe(3); // user1 has 2 with tag1, user2 has 1
    });

    it('filters by author username', async () => {
        const query: ListArticlesQuery = { author: 'user1' };
        const result = await ArticleModule.getList(query);

        expect(result.articles.every(a => a.author.username === 'user1')).toBe(true);
        expect(result.articlesCount).toBe(3);
    });

    it('filters by favorited username', async () => {
        const query: ListArticlesQuery = { favorited: 'user1' };
        const result = await ArticleModule.getList(query, users[0]);

        expect(result.articles.every(a => a.favorited === true)).toBe(true);
        expect(result.articlesCount).toBe(1);
        expect(result.articles[0].slug).toBe(articles[3].slug);
    });

    it('returns empty array for non-existent tag', async () => {
        const query: ListArticlesQuery = { tag: 'nonexistent' };
        const result = await ArticleModule.getList(query);

        expect(result.articles).toEqual([]);
        expect(result.articlesCount).toBe(0);
    });

    it('returns all articles when author does not exist (current behavior)', async () => {
        const query: ListArticlesQuery = { author: 'nonexistentuser' };
        const result = await ArticleModule.getList(query);

        expect(result.articlesCount).toBe(6);
    });

    it('returns all articles when favorited user does not exist (current behavior)', async () => {
        const query: ListArticlesQuery = { favorited: 'nonexistentuser' };
        const result = await ArticleModule.getList(query);

        expect(result.articlesCount).toBe(6);
    });

    it('includes favorited=true when viewer has favorited articles', async () => {
        const query: ListArticlesQuery = { limit: 100 };
        const result = await ArticleModule.getList(query, users[0]);

        const favoritedArticle = result.articles.find(a => a.slug === articles[3].slug);
        expect(favoritedArticle).toBeDefined();
        expect(favoritedArticle!.favorited).toBe(true);
    });

    it('includes following=true on author when viewer follows them', async () => {
        const query: ListArticlesQuery = { limit: 100 };
        const result = await ArticleModule.getList(query, users[0]);

        const user2Article = result.articles.find(a => a.author.username === 'user2');
        expect(user2Article).toBeDefined();
        expect(user2Article!.author.following).toBe(true);
    });

    it('sorts articles by createdAt descending (newest first)', async () => {
        const query: ListArticlesQuery = { limit: 100 };
        const result = await ArticleModule.getList(query);

        for (let i = 1; i < result.articles.length; i++) {
            expect(new Date(result.articles[i - 1].createdAt).getTime())
                .toBeGreaterThanOrEqual(new Date(result.articles[i].createdAt).getTime());
        }
    });

    it('combines tag and author filters', async () => {
        const query: ListArticlesQuery = { tag: 'tag1', author: 'user1' };
        const result = await ArticleModule.getList(query);

        expect(result.articles.every(a => a.tagList.includes('tag1') && a.author.username === 'user1')).toBe(true);
        expect(result.articlesCount).toBe(2);
    });

    it('combines tag and favorited filters', async () => {
        const query: ListArticlesQuery = { tag: 'tag3', favorited: 'user1' };
        const result = await ArticleModule.getList(query, users[0]);

        expect(result.articles.every(a => a.tagList.includes('tag3') && a.favorited === true)).toBe(true);
        expect(result.articlesCount).toBe(1);
    });

    it('returns empty array when no articles match combined filters', async () => {
        const query: ListArticlesQuery = { tag: 'tag4', author: 'user1' };
        const result = await ArticleModule.getList(query);

        expect(result.articles).toEqual([]);
        expect(result.articlesCount).toBe(0);
    });

    it('returns favorited=false and following=false for all articles when viewer is false', async () => {
        const query: ListArticlesQuery = { limit: 100 };
        const result = await ArticleModule.getList(query, false);

        expect(result.articles.every(a => a.favorited === false)).toBe(true);
        expect(result.articles.every(a => a.author.following === false)).toBe(true);
    });
});