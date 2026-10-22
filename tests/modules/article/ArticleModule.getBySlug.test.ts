import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleModule } from '@/src/modules/article/ArticleModule';
import User from '@/models/User';
import Article from '@/models/Article';
import type { IUser } from '@/models/User';
import type { IArticle } from '@/models/Article';
import { NotFoundError } from '@/src/shared/errors/AppError';
import mongoose from 'mongoose';

describe('ArticleModule.getBySlug', () => {
    let author: IUser;
    let viewer: IUser;
    let article: IArticle;

    beforeEach(async () => {
        author = await new User({
            username: 'author',
            email: 'author@example.com',
            password: 'password123',
            bio: 'Author bio',
            image: 'https://example.com/author.jpg',
        }).save();

        viewer = await new User({
            username: 'viewer',
            email: 'viewer@example.com',
            password: 'password123',
            bio: 'Viewer bio',
            image: 'https://example.com/viewer.jpg',
        }).save();

        article = await new Article({
            title: 'Test Article',
            description: 'Test description',
            body: 'Test body content',
            tagList: ['tag1', 'tag2'],
            author: author._id,
        }).save();
    });

    it('returns ArticleResponse with correct shape when article exists', async () => {
        const result = await ArticleModule.getBySlug(article.slug);

        expect(result).toHaveProperty('slug', article.slug);
        expect(result).toHaveProperty('title', article.title);
        expect(result).toHaveProperty('description', article.description);
        expect(result).toHaveProperty('body', article.body);
        expect(result).toHaveProperty('tagList', article.tagList);
        expect(result).toHaveProperty('favorited', false);
        expect(result).toHaveProperty('favoritesCount', 0);
        expect(result).toHaveProperty('createdAt');
        expect(result).toHaveProperty('updatedAt');
        expect(result.author).toHaveProperty('username', author.username);
        expect(result.author).toHaveProperty('bio', author.bio);
        expect(result.author).toHaveProperty('image', author.image);
        expect(result.author).toHaveProperty('following', false);
    });

    it('includes favorited=true when viewer has favorited the article', async () => {
        await viewer.favorite(article._id);
        await article.updateFavoriteCount();

        const result = await ArticleModule.getBySlug(article.slug, viewer);

        expect(result.favorited).toBe(true);
        expect(result.favoritesCount).toBe(1);
    });

    it('includes favorited=false when viewer has not favorited the article', async () => {
        const result = await ArticleModule.getBySlug(article.slug, viewer);

        expect(result.favorited).toBe(false);
        expect(result.favoritesCount).toBe(0);
    });

    it('includes following=true on author when viewer follows author', async () => {
        await viewer.follow(author._id);

        const result = await ArticleModule.getBySlug(article.slug, viewer);

        expect(result.author.following).toBe(true);
    });

    it('includes following=false on author when viewer does not follow author', async () => {
        const result = await ArticleModule.getBySlug(article.slug, viewer);

        expect(result.author.following).toBe(false);
    });

    it('returns favorited=false and following=false when viewer is false (unauthenticated)', async () => {
        const result = await ArticleModule.getBySlug(article.slug, false);

        expect(result.favorited).toBe(false);
        expect(result.author.following).toBe(false);
    });

    it('throws NotFoundError when article does not exist', async () => {
        await expect(ArticleModule.getBySlug('non-existent-slug'))
            .rejects.toThrow(NotFoundError);
    });

    it('returns correct author profile even when viewer is different user', async () => {
        const result = await ArticleModule.getBySlug(article.slug, viewer);

        expect(result.author.username).toBe(author.username);
        expect(result.author.bio).toBe(author.bio);
        expect(result.author.image).toBe(author.image);
    });

    it('handles article with empty tagList', async () => {
        const articleNoTags = await new Article({
            title: 'No Tags Article',
            description: 'Description',
            body: 'Body',
            tagList: [],
            author: author._id,
        }).save();

        const result = await ArticleModule.getBySlug(articleNoTags.slug);

        expect(result.tagList).toEqual([]);
    });
});