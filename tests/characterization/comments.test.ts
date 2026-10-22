import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import createTestAgent from '../utils/test-app';
import { seedUser, seedArticle, authHeader } from '../utils/fixtures';
import Article from '@/models/Article';
import Comment from '@/models/Comment';
import mongoose from 'mongoose';
import type { IUser } from '@/models/User';
import type { IArticle } from '@/models/Article';
import type { IComment } from '@/models/Comment';

// ============================================================================
// COMMENT DTO INTERFACE
// ============================================================================

interface CommentDTO {
    id: string;
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

// ============================================================================
// CORPUS FIXTURE: Users, Articles, Comments
// ============================================================================

const USERS_COUNT = 10;
const ARTICLES_PER_USER = 5;
const ARTICLES_COUNT = USERS_COUNT * ARTICLES_PER_USER; // 50
const COMMENTS_PER_ARTICLE = 3;

interface Corpus {
    users: IUser[];
    articles: IArticle[];
    comments: CommentDoc[];
}

let corpus: Corpus;
let agent: ReturnType<typeof createTestAgent>;

type CommentDoc = mongoose.Document<unknown, object, IComment> & IComment & { _id: mongoose.Types.ObjectId; __v: number };

async function buildCorpus(): Promise<Corpus> {
    // Create 10 users
    const users: IUser[] = [];
    for (let i = 0; i < USERS_COUNT; i++) {
        const user = await seedUser({
            username: `author${i}`,
            email: `author${i}@example.com`,
            bio: `Bio for author ${i}`,
            image: `https://example.com/avatar${i}.jpg`,
        });
        users.push(user);
    }

    // Create 50 articles distributed among users
    const articles: IArticle[] = [];
    for (let i = 0; i < ARTICLES_COUNT; i++) {
        const author = users[i % USERS_COUNT];
        const article = await seedArticle({
            title: `Article ${i + 1}: ${author.username}'s article`,
            description: `Description for article ${i + 1}`,
            body: `Body content for article ${i + 1}. This is a test article.`,
            tagList: ['tag1', 'tag2'],
            author,
        });
        articles.push(article);
    }

    // Create follow relationships: user0 follows user1; user1 follows user2; etc.
    for (let i = 0; i < USERS_COUNT - 1; i++) {
        await users[i].follow(users[i + 1]._id);
    }
    // user9 follows user0 (circular)
    await users[USERS_COUNT - 1].follow(users[0]._id);

    // Create favorites: each user favorites 5 articles (not their own)
    for (let i = 0; i < USERS_COUNT; i++) {
        const user = users[i];
        for (let j = 0; j < ARTICLES_PER_USER; j++) {
            const articleIndex = (i * ARTICLES_PER_USER + j) % ARTICLES_COUNT;
            const article = articles[articleIndex];
            if (article.author.toString() !== user._id.toString()) {
                await user.favorite(article._id);
            }
        }
    }

    // Update favorite counts on articles
    for (const article of articles) {
        await article.updateFavoriteCount();
    }

    // Create comments: 3 comments per article (from different users)
    const comments: CommentDoc[] = [];
    for (let i = 0; i < ARTICLES_COUNT; i++) {
        const article = articles[i];
        for (let j = 0; j < COMMENTS_PER_ARTICLE; j++) {
            const commentAuthor = users[(i + j + 1) % USERS_COUNT];
            const comment = new Comment({
                body: `Comment ${j + 1} on article ${i + 1} by ${commentAuthor.username}`,
                author: commentAuthor._id,
                article: article._id,
            });
            await comment.save();
            await article.addComment(comment._id);
            comments.push(comment);
        }
    }

    return { users, articles, comments };
}

describe('CommentModule — HTTP Characterization Tests', () => {
    beforeAll(async () => {
        agent = createTestAgent();
        corpus = await buildCorpus();
    }, 120000);

    beforeEach(async () => {
        // Rebuild corpus for test isolation if needed
        // The setup.ts beforeEach clears collections, so we need to rebuild
        corpus = await buildCorpus();
    }, 120000);

    // ========================================================================
    // HELPER: Validate CommentDTO shape
    // ========================================================================
    const expectCommentDTO = (comment: CommentDTO) => {
        expect(comment).toHaveProperty('id');
        expect(comment).toHaveProperty('body');
        expect(comment).toHaveProperty('createdAt');
        expect(comment).toHaveProperty('updatedAt');
        expect(comment).toHaveProperty('author');
        expect(comment.author).toHaveProperty('username');
        expect(comment.author).toHaveProperty('bio');
        expect(comment.author).toHaveProperty('image');
        expect(comment.author).toHaveProperty('following');
        expect(typeof comment.author.following).toBe('boolean');
    };

    // ========================================================================
    // GET /articles/:slug/comments — Get Comments (auth optional)
    // ========================================================================
    describe('GET /articles/:slug/comments', () => {
        it('returns 200 with comments array when article exists', async () => {
            const article = corpus.articles[0];
            const response = await agent.get(`/api/articles/${article.slug}/comments`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('comments');
            expect(Array.isArray(response.body.comments)).toBe(true);
            expect(response.body.comments.length).toBe(COMMENTS_PER_ARTICLE);

            expectCommentDTO(response.body.comments[0]);
        });

        it('returns comments with correct author information', async () => {
            const article = corpus.articles[0];
            const response = await agent.get(`/api/articles/${article.slug}/comments`);

            expect(response.status).toBe(200);
            const comment = response.body.comments[0];
            expect(comment.author).toHaveProperty('username');
            expect(comment.author).toHaveProperty('bio');
            expect(comment.author).toHaveProperty('image');
            expect(comment.author).toHaveProperty('following');
            expect(typeof comment.author.username).toBe('string');
        });

        it('returns 404 when article does not exist', async () => {
            const response = await agent.get('/api/articles/non-existent-slug-123/comments');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message');
        });

        it('returns empty array when article has no comments', async () => {
            const user = corpus.users[0];
            const newArticle = await seedArticle({
                title: 'Article Without Comments',
                description: 'No comments',
                body: 'Body content',
                tagList: [],
                author: user,
            });

            const response = await agent.get(`/api/articles/${newArticle.slug}/comments`);

            expect(response.status).toBe(200);
            expect(response.body.comments).toEqual([]);
        });

        it('includes following=true on author when authenticated user follows them', async () => {
            const user = corpus.users[0]; // follows user1
            const followedAuthor = corpus.users[1];
            // Find an article that has a comment by the followed author (user1)
            // user1 comments on articles where (i + j + 1) % 10 === 1, e.g., article 0 (j=0)
            const articleWithCommentByFollowed = corpus.articles[0]; // authored by user0, has comment by user1

            const response = await agent
                .get(`/api/articles/${articleWithCommentByFollowed.slug}/comments`)
                .set(authHeader(user));

            expect(response.status).toBe(200);
            const comment = response.body.comments.find((c: CommentDTO) => c.author.username === followedAuthor.username);
            expect(comment).toBeDefined();
            expect(comment!.author.following).toBe(true);
        });

        it('includes following=false on author when authenticated user does not follow them', async () => {
            const user = corpus.users[0]; // follows user1, does not follow user2
            const notFollowedAuthor = corpus.users[2];
            // Find an article that has a comment by the not-followed author (user2)
            // user2 comments on articles where (i + j + 1) % 10 === 2, e.g., article 1 (j=0)
            const articleWithCommentByNotFollowed = corpus.articles[1]; // authored by user1, has comment by user2

            const response = await agent
                .get(`/api/articles/${articleWithCommentByNotFollowed.slug}/comments`)
                .set(authHeader(user));

            expect(response.status).toBe(200);
            const comment = response.body.comments.find((c: CommentDTO) => c.author.username === notFollowedAuthor.username);
            expect(comment).toBeDefined();
            expect(comment!.author.following).toBe(false);
        });

        it('returns following=false when unauthenticated', async () => {
            const article = corpus.articles[0];
            const response = await agent.get(`/api/articles/${article.slug}/comments`);

            expect(response.status).toBe(200);
            for (const comment of response.body.comments) {
                expect(comment.author.following).toBe(false);
            }
        });

        it('returns comments sorted by createdAt ascending (oldest first)', async () => {
            const article = corpus.articles[0];
            const response = await agent.get(`/api/articles/${article.slug}/comments`);

            expect(response.status).toBe(200);
            const comments = response.body.comments;
            for (let i = 1; i < comments.length; i++) {
                expect(new Date(comments[i - 1].createdAt).getTime())
                    .toBeLessThanOrEqual(new Date(comments[i].createdAt).getTime());
            }
        });
    });

    // ========================================================================
    // POST /articles/:slug/comments — Add Comment (auth required)
    // ========================================================================
    describe('POST /articles/:slug/comments', () => {
        it('returns 401 when unauthenticated', async () => {
            const article = corpus.articles[0];
            const response = await agent
                .post(`/api/articles/${article.slug}/comments`)
                .send({ comment: { body: 'Test comment' } });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });

        it('returns 404 when article does not exist', async () => {
            const user = corpus.users[0];
            const response = await agent
                .post('/api/articles/non-existent-slug-123/comments')
                .set(authHeader(user))
                .send({ comment: { body: 'Test comment' } });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message');
        });

        it('returns 422 when body is missing', async () => {
            const user = corpus.users[0];
            const article = corpus.articles[0];
            const response = await agent
                .post(`/api/articles/${article.slug}/comments`)
                .set(authHeader(user))
                .send({ comment: {} });

            expect(response.status).toBe(422);
            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors).toHaveProperty('body');
        });

        it('returns 422 when body is empty string', async () => {
            const user = corpus.users[0];
            const article = corpus.articles[0];
            const response = await agent
                .post(`/api/articles/${article.slug}/comments`)
                .set(authHeader(user))
                .send({ comment: { body: '' } });

            expect(response.status).toBe(422);
            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors).toHaveProperty('body');
        });

        it('returns 201 with created CommentDTO on success', async () => {
            const user = corpus.users[0];
            const article = corpus.articles[0];
            const commentBody = 'This is a new test comment';

            const response = await agent
                .post(`/api/articles/${article.slug}/comments`)
                .set(authHeader(user))
                .send({ comment: { body: commentBody } });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('comment');
            expectCommentDTO(response.body.comment);
            expect(response.body.comment.body).toBe(commentBody);
            expect(response.body.comment.author.username).toBe(user.username);
            expect(response.body.comment.author.following).toBe(false);
        });

        it('persists comment in database and adds to article', async () => {
            const user = corpus.users[0];
            const article = corpus.articles[0];
            const originalCommentCount = article.comments.length;

            const response = await agent
                .post(`/api/articles/${article.slug}/comments`)
                .set(authHeader(user))
                .send({ comment: { body: 'Persisted comment' } });

            expect(response.status).toBe(201);
            const saved = await Comment.findById(response.body.comment.id).exec();
            expect(saved).not.toBeNull();
            expect(saved?.body).toBe('Persisted comment');
            expect(saved?.author.toString()).toBe(user._id.toString());
            expect(saved?.article.toString()).toBe(article._id.toString());

            const updatedArticle = await Article.findById(article._id).exec();
            expect(updatedArticle?.comments.length).toBe(originalCommentCount + 1);
        });

        it('different users can comment on same article', async () => {
            const user1 = corpus.users[0];
            const user2 = corpus.users[1];
            const article = corpus.articles[0];

            const response1 = await agent
                .post(`/api/articles/${article.slug}/comments`)
                .set(authHeader(user1))
                .send({ comment: { body: 'Comment from user1' } });

            const response2 = await agent
                .post(`/api/articles/${article.slug}/comments`)
                .set(authHeader(user2))
                .send({ comment: { body: 'Comment from user2' } });

            expect(response1.status).toBe(201);
            expect(response2.status).toBe(201);
            expect(response1.body.comment.author.username).toBe(user1.username);
            expect(response2.body.comment.author.username).toBe(user2.username);

            const updatedArticle = await Article.findById(article._id).exec();
            expect(updatedArticle?.comments.length).toBe(COMMENTS_PER_ARTICLE + 2);
        });
    });

    // ========================================================================
    // DELETE /articles/:slug/comments/:id — Delete Comment (auth required, author only)
    // ========================================================================
    describe('DELETE /articles/:slug/comments/:id', () => {
        it('returns 401 when unauthenticated', async () => {
            const article = corpus.articles[0];
            const comment = corpus.comments[0];
            const response = await agent.delete(`/api/articles/${article.slug}/comments/${comment._id}`);

            expect(response.status).toBe(401);
        });

        it('returns 404 when article does not exist', async () => {
            const user = corpus.users[0];
            const comment = corpus.comments[0];
            const response = await agent
                .delete(`/api/articles/non-existent-slug-123/comments/${comment._id}`)
                .set(authHeader(user));

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message');
        });

        it('returns 404 when comment does not exist', async () => {
            const user = corpus.users[0];
            const article = corpus.articles[0];
            const nonExistentCommentId = new mongoose.Types.ObjectId().toString();
            const response = await agent
                .delete(`/api/articles/${article.slug}/comments/${nonExistentCommentId}`)
                .set(authHeader(user));

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message');
        });

        it('returns 403 when authenticated user is not the comment author', async () => {
            const article = corpus.articles[0];
            const comment = corpus.comments[0]; // authored by users[1]
            const nonAuthor = corpus.users[2]; // users[2] is not the author
            const response = await agent
                .delete(`/api/articles/${article.slug}/comments/${comment._id}`)
                .set(authHeader(nonAuthor));

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe('Only the author can delete their comment');
        });

        it('returns 200 with success message when author deletes their comment', async () => {
            const article = corpus.articles[0];
            const comment = corpus.comments[0]; // authored by users[1]
            const author = corpus.users[1];
            const response = await agent
                .delete(`/api/articles/${article.slug}/comments/${comment._id}`)
                .set(authHeader(author));

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe('Comment successfully deleted');
        });

        it('removes comment from database and article', async () => {
            const article = corpus.articles[0];
            const comment = corpus.comments[0]; // authored by users[1]
            const author = corpus.users[1];
            const originalCommentCount = article.comments.length;

            await agent
                .delete(`/api/articles/${article.slug}/comments/${comment._id}`)
                .set(authHeader(author));

            const deleted = await Comment.findById(comment._id).exec();
            expect(deleted).toBeNull();

            const updatedArticle = await Article.findById(article._id).exec();
            expect(updatedArticle?.comments.length).toBe(originalCommentCount - 1);
            expect(updatedArticle?.comments.some(id => id.equals(comment._id))).toBe(false);
        });

        it('author can delete their comment on article they did not author', async () => {
            const article = corpus.articles[1]; // authored by users[1]
            const comment = corpus.comments[3]; // on article 1, authored by users[2]
            const author = corpus.users[2];
            const response = await agent
                .delete(`/api/articles/${article.slug}/comments/${comment._id}`)
                .set(authHeader(author));

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Comment successfully deleted');
        });

        it('article author cannot delete comments by other users', async () => {
            const article = corpus.articles[0]; // authored by users[0]
            const comment = corpus.comments[0]; // authored by users[1]
            const articleAuthor = corpus.users[0];
            const response = await agent
                .delete(`/api/articles/${article.slug}/comments/${comment._id}`)
                .set(authHeader(articleAuthor));

            expect(response.status).toBe(403);
            expect(response.body.message).toBe('Only the author can delete their comment');
        });
    });
});