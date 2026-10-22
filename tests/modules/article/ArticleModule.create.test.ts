import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleModule } from '@/src/modules/article/ArticleModule';
import User from '@/models/User';
import Article from '@/models/Article';
import type { IUser } from '@/models/User';
import type { CreateArticleInput } from '@/src/modules/article/ArticleModule';
import { ValidationError, UnauthorizedError } from '@/src/shared/errors/AppError';
import mongoose from 'mongoose';

describe('ArticleModule.create', () => {
    let author: IUser;

    beforeEach(async () => {
        author = await new User({
            username: 'testauthor',
            email: 'author@example.com',
            password: 'password123',
            bio: 'Test bio',
            image: 'https://example.com/image.jpg',
        }).save();
    });

    const validInput: CreateArticleInput = {
        title: 'Test Article',
        description: 'Test description',
        body: 'Test body content',
        tagList: ['tag1', 'tag2'],
    };

    it('creates an article and returns ArticleResponse with correct shape', async () => {
        const result = await ArticleModule.create(author._id.toString(), validInput);

        expect(result).toHaveProperty('slug');
        expect(result).toHaveProperty('title', validInput.title);
        expect(result).toHaveProperty('description', validInput.description);
        expect(result).toHaveProperty('body', validInput.body);
        expect(result).toHaveProperty('tagList', validInput.tagList);
        expect(result).toHaveProperty('favorited', false);
        expect(result).toHaveProperty('favoritesCount', 0);
        expect(result).toHaveProperty('createdAt');
        expect(result).toHaveProperty('updatedAt');
        expect(result.author).toHaveProperty('username', author.username);
        expect(result.author).toHaveProperty('bio', author.bio);
        expect(result.author).toHaveProperty('image', author.image);
        expect(result.author).toHaveProperty('following', false);
    });

    it('generates slug from title', async () => {
        const input: CreateArticleInput = {
            title: 'My Awesome Article Title',
            description: 'Description',
            body: 'Body',
        };

        const result = await ArticleModule.create(author._id.toString(), input);

        expect(result.slug).toBe('my-awesome-article-title');
    });

    it('creates article with empty tagList when not provided', async () => {
        const input: CreateArticleInput = {
            title: 'Article Without Tags',
            description: 'No tags',
            body: 'Body content',
        };

        const result = await ArticleModule.create(author._id.toString(), input);

        expect(result.tagList).toEqual([]);
    });

    it('persists article in database', async () => {
        const result = await ArticleModule.create(author._id.toString(), validInput);

        const saved = await Article.findOne({ slug: result.slug }).exec();
        expect(saved).not.toBeNull();
        expect(saved?.title).toBe(validInput.title);
        expect(saved?.author.toString()).toBe(author._id.toString());
        expect(saved?.tagList).toEqual(validInput.tagList);
    });

    it('throws ValidationError when title is missing', async () => {
        const input = {
            description: 'Test description',
            body: 'Test body content',
        } as Partial<CreateArticleInput>;

        await expect(ArticleModule.create(author._id.toString(), input as CreateArticleInput))
            .rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when description is missing', async () => {
        const input = {
            title: 'Test Article',
            body: 'Test body content',
        } as Partial<CreateArticleInput>;

        await expect(ArticleModule.create(author._id.toString(), input as CreateArticleInput))
            .rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when body is missing', async () => {
        const input = {
            title: 'Test Article',
            description: 'Test description',
        } as Partial<CreateArticleInput>;

        await expect(ArticleModule.create(author._id.toString(), input as CreateArticleInput))
            .rejects.toThrow(ValidationError);
    });

    it('throws ValidationError with all missing fields when empty input', async () => {
        const input = {} as Partial<CreateArticleInput>;

        await expect(ArticleModule.create(author._id.toString(), input as CreateArticleInput))
            .rejects.toThrow(ValidationError);
    });

    it('throws UnauthorizedError when author not found', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();

        await expect(ArticleModule.create(nonExistentId, validInput))
            .rejects.toThrow(UnauthorizedError);
    });

    it('sets author reference correctly on created article', async () => {
        const result = await ArticleModule.create(author._id.toString(), validInput);

        const saved = await Article.findOne({ slug: result.slug }).exec();
        expect(saved?.author.toString()).toBe(author._id.toString());
    });

    it('handles special characters in title for slug generation', async () => {
        const input: CreateArticleInput = {
            title: 'Article with Special Chars!@#$%^&*()',
            description: 'Description',
            body: 'Body',
        };

        const result = await ArticleModule.create(author._id.toString(), input);

        expect(result.slug).toMatch(/^article-with-special-chars/);
    });
});