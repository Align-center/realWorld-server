import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleModule } from '@/src/modules/article/ArticleModule';
import User from '@/models/User';
import Article from '@/models/Article';
import type { IUser } from '@/models/User';
import type { IArticle } from '@/models/Article';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/src/shared/errors/AppError';
import mongoose from 'mongoose';

describe('ArticleModule.delete', () => {
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
            title: 'Article to Delete',
            description: 'Description',
            body: 'Body content',
            tagList: ['tag1', 'tag2'],
            author: author._id,
        }).save();
    });

    it('throws UnauthorizedError when user not found', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();

        await expect(ArticleModule.delete(nonExistentId, article.slug))
            .rejects.toThrow(UnauthorizedError);
    });

    it('throws NotFoundError when article does not exist', async () => {
        await expect(ArticleModule.delete(author._id.toString(), 'non-existent-slug'))
            .rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when user is not the author', async () => {
        await expect(ArticleModule.delete(nonAuthor._id.toString(), article.slug))
            .rejects.toThrow(ForbiddenError);
    });

    it('returns success message when author deletes their article', async () => {
        const result = await ArticleModule.delete(author._id.toString(), article.slug);

        expect(result).toHaveProperty('message');
        expect(result.message).toBe('Article successfully deleted!!!');
    });

    it('removes article from database', async () => {
        await ArticleModule.delete(author._id.toString(), article.slug);

        const deleted = await Article.findOne({ slug: article.slug }).exec();
        expect(deleted).toBeNull();
    });

    it('does not remove article when non-author attempts deletion', async () => {
        try {
            await ArticleModule.delete(nonAuthor._id.toString(), article.slug);
        } catch (error) {
            // Expected to throw ForbiddenError
        }

        const stillExists = await Article.findOne({ slug: article.slug }).exec();
        expect(stillExists).not.toBeNull();
        expect(stillExists?.title).toBe(article.title);
    });

    it('allows author to delete after non-author attempt fails', async () => {
        try {
            await ArticleModule.delete(nonAuthor._id.toString(), article.slug);
        } catch (error) {
            // Expected
        }

        const result = await ArticleModule.delete(author._id.toString(), article.slug);
        expect(result.message).toBe('Article successfully deleted!!!');

        const deleted = await Article.findOne({ slug: article.slug }).exec();
        expect(deleted).toBeNull();
    });
});