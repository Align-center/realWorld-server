import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleModule } from '@/src/modules/article/ArticleModule';
import User from '@/models/User';
import Article from '@/models/Article';
import type { IUser } from '@/models/User';
import type { IArticle } from '@/models/Article';
import type { UpdateArticleInput } from '@/src/modules/article/ArticleModule';
import { UnauthorizedError, NotFoundError } from '@/src/shared/errors/AppError';
import mongoose from 'mongoose';

describe('ArticleModule.update', () => {
    let author: IUser;
    let nonAuthor: IUser;
    let article: IArticle;

    beforeEach(async () => {
        author = await new User({
            username: 'author',
            email: 'author@example.com',
            password: 'password123',
            bio: 'Author bio',
            image: 'https://example.com/author.jpg',
        }).save();

        nonAuthor = await new User({
            username: 'nonauthor',
            email: 'nonauthor@example.com',
            password: 'password123',
            bio: 'Non-author bio',
            image: 'https://example.com/nonauthor.jpg',
        }).save();

        article = await new Article({
            title: 'Original Title',
            description: 'Original description',
            body: 'Original body content',
            tagList: ['tag1', 'tag2'],
            author: author._id,
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
        const input: UpdateArticleInput = { title: 'Updated Title' };

        await expect(ArticleModule.update(nonExistentId, article.slug, input))
            .rejects.toThrow(UnauthorizedError);
    });

    it('throws NotFoundError when article does not exist', async () => {
        const input: UpdateArticleInput = { title: 'Updated Title' };

        await expect(ArticleModule.update(author._id.toString(), 'non-existent-slug', input))
            .rejects.toThrow(NotFoundError);
    });

    it('allows non-author to update article (current behavior - no author check)', async () => {
        const input: UpdateArticleInput = { title: 'Updated by Non-Author' };

        const result = await ArticleModule.update(nonAuthor._id.toString(), article.slug, input);

        expect(result.title).toBe('Updated by Non-Author');
        expect(result.slug).toBe('updated-by-non-author');
        expectArticleResponseShape(result);
    });

    it('updates title and regenerates slug', async () => {
        const input: UpdateArticleInput = { title: 'New Title Here' };

        const result = await ArticleModule.update(author._id.toString(), article.slug, input);

        expect(result.title).toBe('New Title Here');
        expect(result.slug).toBe('new-title-here');
        expectArticleResponseShape(result);
    });

    it('updates description without changing slug', async () => {
        const originalSlug = article.slug;
        const input: UpdateArticleInput = { description: 'Updated description' };

        const result = await ArticleModule.update(author._id.toString(), article.slug, input);

        expect(result.description).toBe('Updated description');
        expect(result.slug).toBe(originalSlug);
        expectArticleResponseShape(result);
    });

    it('updates body without changing slug', async () => {
        const originalSlug = article.slug;
        const input: UpdateArticleInput = { body: 'Updated body content' };

        const result = await ArticleModule.update(author._id.toString(), article.slug, input);

        expect(result.body).toBe('Updated body content');
        expect(result.slug).toBe(originalSlug);
        expectArticleResponseShape(result);
    });

    it('updates tagList', async () => {
        const input: UpdateArticleInput = { tagList: ['newtag1', 'newtag2', 'newtag3'] };

        const result = await ArticleModule.update(author._id.toString(), article.slug, input);

        expect(result.tagList).toEqual(['newtag1', 'newtag2', 'newtag3']);
        expectArticleResponseShape(result);
    });

    it('performs partial update (only provided fields change)', async () => {
        const originalDescription = article.description;
        const originalBody = article.body;
        const originalTagList = article.tagList;
        const input: UpdateArticleInput = { title: 'Only Title Changed' };

        const result = await ArticleModule.update(author._id.toString(), article.slug, input);

        expect(result.title).toBe('Only Title Changed');
        expect(result.description).toBe(originalDescription);
        expect(result.body).toBe(originalBody);
        expect(result.tagList).toEqual(originalTagList);
        expectArticleResponseShape(result);
    });

    it('persists updates in database', async () => {
        const input: UpdateArticleInput = { title: 'Persisted Update' };

        await ArticleModule.update(author._id.toString(), article.slug, input);

        const updated = await Article.findOne({ slug: 'persisted-update' }).exec();
        expect(updated).not.toBeNull();
        expect(updated?.title).toBe('Persisted Update');
        expect(updated?.author.toString()).toBe(author._id.toString());
    });

    it('returns updated article with viewer-specific favorited/following fields', async () => {
        // nonAuthor favorites the article
        await nonAuthor.favorite(article._id);
        await article.updateFavoriteCount();
        // nonAuthor follows author
        await nonAuthor.follow(author._id);

        const input: UpdateArticleInput = { title: 'Updated with Viewer' };
        const result = await ArticleModule.update(nonAuthor._id.toString(), article.slug, input);

        expect(result.favorited).toBe(true);
        expect(result.favoritesCount).toBe(1);
        expect(result.author.following).toBe(true);
        expectArticleResponseShape(result);
    });

    it('handles empty tagList update', async () => {
        const input: UpdateArticleInput = { tagList: [] };

        const result = await ArticleModule.update(author._id.toString(), article.slug, input);

        expect(result.tagList).toEqual([]);
        expectArticleResponseShape(result);
    });
});