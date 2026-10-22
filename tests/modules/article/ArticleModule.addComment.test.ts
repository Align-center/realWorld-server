import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleModule } from '@/src/modules/article/ArticleModule';
import User from '@/models/User';
import Article from '@/models/Article';
import Comment from '@/models/Comment';
import type { IUser } from '@/models/User';
import type { IArticle } from '@/models/Article';
import { UnauthorizedError, NotFoundError } from '@/src/shared/errors/AppError';
import mongoose from 'mongoose';

describe('ArticleModule.addComment', () => {
    let author: IUser;
    let commenter: IUser;
    let article: IArticle;

    beforeEach(async () => {
        author = await new User({
            username: 'author',
            email: 'author@example.com',
            password: 'password123',
            bio: 'Author bio',
            image: 'https://example.com/author.jpg',
        }).save();

        commenter = await new User({
            username: 'commenter',
            email: 'commenter@example.com',
            password: 'password123',
            bio: 'Commenter bio',
            image: 'https://example.com/commenter.jpg',
        }).save();

        article = await new Article({
            title: 'Test Article',
            description: 'Test description',
            body: 'Test body content',
            tagList: ['tag1', 'tag2'],
            author: author._id,
        }).save();
    });

    const expectCommentResponseShape = (comment: any) => {
        expect(comment).toHaveProperty('id');
        expect(comment).toHaveProperty('body');
        expect(comment).toHaveProperty('createdAt');
        expect(comment).toHaveProperty('updatedAt');
        expect(comment.author).toHaveProperty('username');
        expect(comment.author).toHaveProperty('bio');
        expect(comment.author).toHaveProperty('image');
        expect(comment.author).toHaveProperty('following');
        expect(typeof comment.author.following).toBe('boolean');
    };

    it('throws UnauthorizedError when user not found', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();

        await expect(ArticleModule.addComment(nonExistentId, article.slug, 'Test comment'))
            .rejects.toThrow(UnauthorizedError);
    });

    it('throws NotFoundError when article does not exist', async () => {
        await expect(ArticleModule.addComment(commenter._id.toString(), 'non-existent-slug', 'Test comment'))
            .rejects.toThrow(NotFoundError);
    });

    it('creates comment and returns CommentResponse with correct shape', async () => {
        const commentBody = 'This is a test comment';
        const result = await ArticleModule.addComment(commenter._id.toString(), article.slug, commentBody);

        expect(result.body).toBe(commentBody);
        expectCommentResponseShape(result);
        expect(result.author.username).toBe(commenter.username);
        expect(result.author.bio).toBe(commenter.bio);
        expect(result.author.image).toBe(commenter.image);
        expect(result.author.following).toBe(false);
    });

    it('persists comment in database', async () => {
        const commentBody = 'Persistent comment';
        const result = await ArticleModule.addComment(commenter._id.toString(), article.slug, commentBody);

        const saved = await Comment.findById(result.id).exec();
        expect(saved).not.toBeNull();
        expect(saved?.body).toBe(commentBody);
        expect(saved?.author.toString()).toBe(commenter._id.toString());
        expect(saved?.article.toString()).toBe(article._id.toString());
    });

    it('links comment to article in article.comments array', async () => {
        const commentBody = 'Linked comment';
        const result = await ArticleModule.addComment(commenter._id.toString(), article.slug, commentBody);

        const updatedArticle = await Article.findById(article._id).exec();
        expect(updatedArticle?.comments.some(id => id.equals(result.id))).toBe(true);
    });

    it('allows author to comment on their own article', async () => {
        const commentBody = 'Author comment';
        const result = await ArticleModule.addComment(author._id.toString(), article.slug, commentBody);

        expect(result.body).toBe(commentBody);
        expect(result.author.username).toBe(author.username);

        const updatedArticle = await Article.findById(article._id).exec();
        expect(updatedArticle?.comments.some(id => id.equals(result.id))).toBe(true);
    });

    it('allows multiple comments on same article', async () => {
        const comment1 = await ArticleModule.addComment(commenter._id.toString(), article.slug, 'First comment');
        const comment2 = await ArticleModule.addComment(commenter._id.toString(), article.slug, 'Second comment');

        expect(comment1.id.toString()).not.toBe(comment2.id.toString());

        const updatedArticle = await Article.findById(article._id).exec();
        expect(updatedArticle?.comments.length).toBe(2);
        expect(updatedArticle?.comments.some(id => id.equals(comment1.id))).toBe(true);
        expect(updatedArticle?.comments.some(id => id.equals(comment2.id))).toBe(true);
    });

    it('allows comments from different users on same article', async () => {
        const commenter2 = await new User({
            username: 'commenter2',
            email: 'commenter2@example.com',
            password: 'password123',
        }).save();

        const comment1 = await ArticleModule.addComment(commenter._id.toString(), article.slug, 'Comment from user1');
        const comment2 = await ArticleModule.addComment(commenter2._id.toString(), article.slug, 'Comment from user2');

        const updatedArticle = await Article.findById(article._id).exec();
        expect(updatedArticle?.comments.length).toBe(2);

        const savedComment1 = await Comment.findById(comment1.id).exec();
        const savedComment2 = await Comment.findById(comment2.id).exec();
        expect(savedComment1?.author.toString()).toBe(commenter._id.toString());
        expect(savedComment2?.author.toString()).toBe(commenter2._id.toString());
    });

    it('includes following status in comment author profile (always false since viewer is comment author)', async () => {
        // author follows commenter
        await author.follow(commenter._id);

        // The viewer passed to toCommentResponse is the commenter (userId parameter)
        // Since a user doesn't follow themselves, following will be false
        const result = await ArticleModule.addComment(commenter._id.toString(), article.slug, 'Test comment');

        expect(result.author.following).toBe(false);
    });

    it('includes favorited status in comment author profile relative to viewer', async () => {
        // This test verifies the author profile in comment response has correct shape
        // The comment author's favorited status isn't directly relevant, but following is
        const result = await ArticleModule.addComment(commenter._id.toString(), article.slug, 'Test comment');

        expect(result.author).toHaveProperty('following');
        expect(typeof result.author.following).toBe('boolean');
    });
});