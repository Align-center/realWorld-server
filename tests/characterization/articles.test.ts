import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import createTestAgent from '../utils/test-app';
import { seedUser, seedArticle, authHeader, authToken } from '../utils/fixtures';
import Article from '@/models/Article';
import User from '@/models/User';
import Comment, { IComment } from '@/models/Comment';
import mongoose from 'mongoose';

// ============================================================================
// CORPUS FIXTURE: 10 users, 50 articles with varied tags, favorites, comments
// ============================================================================

interface Corpus {
    users: Awaited<ReturnType<typeof seedUser>>[];
    articles: Awaited<ReturnType<typeof seedArticle>>[];
    comments: CommentDoc[];
}

let corpus: Corpus;
let agent: ReturnType<typeof createTestAgent>;

type CommentDoc = mongoose.Document<unknown, {}, IComment> & IComment & { _id: mongoose.Types.ObjectId; __v: number };

const TAGS = [
    'javascript', 'typescript', 'react', 'vue', 'angular',
    'nodejs', 'express', 'nestjs', 'fastify', 'koa',
    'testing', 'jest', 'vitest', 'cypress', 'playwright',
    'database', 'mongodb', 'postgresql', 'redis', 'mysql',
    'devops', 'docker', 'kubernetes', 'aws', 'gcp',
    'architecture', 'microservices', 'monolith', 'serverless', 'graphql',
    'security', 'authentication', 'authorization', 'oauth', 'jwt',
    'performance', 'caching', 'optimization', 'profiling', 'benchmarking',
];

async function buildCorpus(): Promise<Corpus> {
    // Create 10 users
    const users = [];
    for (let i = 0; i < 10; i++) {
        const user = await seedUser({
            username: `author${i}`,
            email: `author${i}@example.com`,
            bio: `Bio for author ${i}`,
            image: `https://example.com/avatar${i}.jpg`,
        });
        users.push(user);
    }

    // Create 50 articles distributed among users
    const articles = [];
    for (let i = 0; i < 50; i++) {
        const author = users[i % 10];
        const tagCount = 1 + (i % 5); // 1-5 tags per article
        const articleTags = TAGS.slice(i * 2, i * 2 + tagCount);
        const article = await seedArticle({
            title: `Article ${i + 1}: ${articleTags.join(' ')}`,
            description: `Description for article ${i + 1}`,
            body: `Body content for article ${i + 1}. This is a test article with various tags.`,
            tagList: articleTags,
            author,
        });
        articles.push(article);
    }

    // Create follow relationships: user0 follows user1, user2; user1 follows user2, user3, etc.
    for (let i = 0; i < 9; i++) {
        const follower = users[i];
        const followee = users[i + 1];
        await follower.follow(followee._id);
    }
    // user9 follows user0 (circular)
    await users[9].follow(users[0]._id);

    // Create favorites: each user favorites some articles
    for (let i = 0; i < 10; i++) {
        const user = users[i];
        // Each user favorites 5 articles (not their own)
        for (let j = 0; j < 5; j++) {
            const articleIndex = (i * 5 + j) % 50;
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
    for (let i = 0; i < 50; i++) {
        const article = articles[i];
        for (let j = 0; j < 3; j++) {
            const commentAuthor = users[(i + j + 1) % 10]; // Different author
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

function getArticleDTO(article: any, user: any = false) {
    return {
        slug: article.slug,
        title: article.title,
        description: article.description,
        body: article.body,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        tagList: article.tagList,
        favorited: user ? user.favouriteArticles.some((id: mongoose.Types.ObjectId) => id.equals(article._id)) : false,
        favoritesCount: article.favouritesCount,
        author: {
            username: '',
            bio: '',
            image: '',
            following: false,
        },
    };
}

describe('ArticleModule — HTTP Characterization Tests', () => {
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
    // HELPER: Validate ArticleDTO shape
    // ========================================================================
    const expectArticleDTO = (article: any) => {
        expect(article).toHaveProperty('slug');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('description');
        expect(article).toHaveProperty('body');
        expect(article).toHaveProperty('createdAt');
        expect(article).toHaveProperty('updatedAt');
        expect(article).toHaveProperty('tagList');
        expect(Array.isArray(article.tagList)).toBe(true);
        expect(article).toHaveProperty('favorited');
        expect(typeof article.favorited).toBe('boolean');
        expect(article).toHaveProperty('favoritesCount');
        expect(typeof article.favoritesCount).toBe('number');
        expect(article).toHaveProperty('author');
        expect(article.author).toHaveProperty('username');
        expect(article.author).toHaveProperty('bio');
        expect(article.author).toHaveProperty('image');
        expect(article.author).toHaveProperty('following');
        expect(typeof article.author.following).toBe('boolean');
    };

    // ========================================================================
    // GET /articles — List Articles (auth optional)
    // ========================================================================
    describe('GET /articles', () => {
        it('returns 200 with paginated articles (default limit 20, offset 0)', async () => {
            const response = await agent.get('/api/articles');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('articles');
            expect(response.body).toHaveProperty('articlesCount');
            expect(Array.isArray(response.body.articles)).toBe(true);
            expect(response.body.articles.length).toBeLessThanOrEqual(20);
            expect(response.body.articlesCount).toBe(50);

            // Check ArticleDTO shape for first article
            expectArticleDTO(response.body.articles[0]);
        });

        it('respects limit query parameter', async () => {
            const response = await agent.get('/api/articles?limit=5');

            expect(response.status).toBe(200);
            expect(response.body.articles.length).toBeLessThanOrEqual(5);
        });

        it('respects offset query parameter', async () => {
            const firstPage = await agent.get('/api/articles?limit=10&offset=0');
            const secondPage = await agent.get('/api/articles?limit=10&offset=10');

            expect(firstPage.status).toBe(200);
            expect(secondPage.status).toBe(200);
            expect(firstPage.body.articles[0].slug).not.toBe(secondPage.body.articles[0].slug);
        });

        it('filters by tag', async () => {
            const tag = TAGS[0]; // 'javascript'
            const response = await agent.get(`/api/articles?tag=${tag}`);

            expect(response.status).toBe(200);
            expect(response.body.articles.every((a: any) => a.tagList.includes(tag))).toBe(true);
        });

        it('filters by author username', async () => {
            const author = corpus.users[0];
            const response = await agent.get(`/api/articles?author=${author.username}`);

            expect(response.status).toBe(200);
            expect(response.body.articles.every((a: any) => a.author.username === author.username)).toBe(true);
        });

        it('filters by favorited username', async () => {
            const favoriter = corpus.users[0];
            // Use a large limit to get all favorited articles, authenticate as the favoriter
            const response = await agent
                .get(`/api/articles?favorited=${favoriter.username}&limit=100`)
                .set(authHeader(favoriter));

            expect(response.status).toBe(200);
            // All returned articles should be favorited by the authenticated user
            for (const article of response.body.articles) {
                expect(article.favorited).toBe(true);
            }
        });

        it('returns empty array for non-existent tag', async () => {
            const response = await agent.get('/api/articles?tag=nonexistenttag123');

            expect(response.status).toBe(200);
            expect(response.body.articles).toEqual([]);
            expect(response.body.articlesCount).toBe(0);
        });

        it('returns all articles when author does not exist (current behavior)', async () => {
            const response = await agent.get('/api/articles?author=nonexistentuser123');

            expect(response.status).toBe(200);
            // Current behavior: when author not found, no author filter is applied, returns all articles
            expect(response.body.articlesCount).toBe(50);
        });

        it('returns all articles when favorited user does not exist (current behavior)', async () => {
            const response = await agent.get('/api/articles?favorited=nonexistentuser123');

            expect(response.status).toBe(200);
            // Current behavior: when favorited user not found, no filter is applied, returns all articles
            expect(response.body.articlesCount).toBe(50);
        });

        it('includes favorited=true when authenticated user has favorited', async () => {
            const user = corpus.users[0];
            const favoritedArticle = corpus.articles.find(a =>
                user.favouriteArticles.some(id => id.equals(a._id))
            );

            if (favoritedArticle) {
                // Use large limit to ensure article is in results
                const response = await agent
                    .get('/api/articles?limit=100')
                    .set(authHeader(user));

                expect(response.status).toBe(200);
                const article = response.body.articles.find((a: any) => a.slug === favoritedArticle.slug);
                expect(article).toBeDefined();
                expect(article.favorited).toBe(true);
            }
        });

        it('includes following=true on author when authenticated user follows them', async () => {
            const user = corpus.users[0]; // follows user1
            const author = corpus.users[1];
            const authorArticle = corpus.articles.find(a => a.author.toString() === author._id.toString());

            if (authorArticle) {
                // Use large limit to ensure article is in results
                const response = await agent
                    .get('/api/articles?limit=100')
                    .set(authHeader(user));

                expect(response.status).toBe(200);
                const article = response.body.articles.find((a: any) => a.slug === authorArticle.slug);
                expect(article).toBeDefined();
                expect(article.author.following).toBe(true);
            }
        });

        it('sorts articles by createdAt descending (newest first)', async () => {
            const response = await agent.get('/api/articles');

            expect(response.status).toBe(200);
            const articles = response.body.articles;
            for (let i = 1; i < articles.length; i++) {
                expect(new Date(articles[i - 1].createdAt).getTime())
                    .toBeGreaterThanOrEqual(new Date(articles[i].createdAt).getTime());
            }
        });
    });

    // ========================================================================
    // GET /articles/feed — User Feed (auth required)
    // ========================================================================
    describe('GET /articles/feed', () => {
        it('returns 401 when unauthenticated', async () => {
            const response = await agent.get('/api/articles/feed');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });

        it('returns 200 with articles from followed authors when authenticated', async () => {
            const user = corpus.users[0]; // follows user1
            const response = await agent
                .get('/api/articles/feed')
                .set(authHeader(user));

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('articles');
            expect(response.body).toHaveProperty('articlesCount');
            expect(Array.isArray(response.body.articles)).toBe(true);

            // All articles should be from followed authors
            const followedAuthorIds = user.followingUsers.map((id: mongoose.Types.ObjectId) => id.toString());
            for (const article of response.body.articles) {
                // The author field in response contains username, need to match by username
                const authorUser = corpus.users.find(u => u.username === article.author.username);
                expect(authorUser).toBeDefined();
                expect(followedAuthorIds).toContain(authorUser!._id.toString());
            }
        });

        it('respects limit and offset pagination', async () => {
            const user = corpus.users[0];
            const response = await agent
                .get('/api/articles/feed?limit=2&offset=0')
                .set(authHeader(user));

            expect(response.status).toBe(200);
            expect(response.body.articles.length).toBeLessThanOrEqual(2);
        });

        it('returns empty array when user follows no authors', async () => {
            // Create a new user who follows no one
            const loneUser = await seedUser({
                username: 'loneuser',
                email: 'lone@example.com',
            });

            const response = await agent
                .get('/api/articles/feed')
                .set(authHeader(loneUser));

            expect(response.status).toBe(200);
            expect(response.body.articles).toEqual([]);
            expect(response.body.articlesCount).toBe(0);
        });

        it('returns ArticleDTO shape with favorited and following fields', async () => {
            const user = corpus.users[0];
            const response = await agent
                .get('/api/articles/feed')
                .set(authHeader(user));

            expect(response.status).toBe(200);
            if (response.body.articles.length > 0) {
                expectArticleDTO(response.body.articles[0]);
            }
        });
    });

    // ========================================================================
    // GET /articles/:slug — Get Single Article (auth optional)
    // ========================================================================
    describe('GET /articles/:slug', () => {
        it('returns 200 with ArticleDTO when article exists', async () => {
            const article = corpus.articles[0];
            const response = await agent.get(`/api/articles/${article.slug}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('article');
            expectArticleDTO(response.body.article);
            expect(response.body.article.slug).toBe(article.slug);
            expect(response.body.article.title).toBe(article.title);
        });

        it('returns 404 when article does not exist', async () => {
            const response = await agent.get('/api/articles/non-existent-slug-123');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message');
        });

        it('includes favorited=true when authenticated user has favorited the article', async () => {
            const user = corpus.users[0];
            const favoritedArticle = corpus.articles.find(a =>
                user.favouriteArticles.some(id => id.equals(a._id))
            );

            if (favoritedArticle) {
                const response = await agent
                    .get(`/api/articles/${favoritedArticle.slug}`)
                    .set(authHeader(user));

                expect(response.status).toBe(200);
                expect(response.body.article.favorited).toBe(true);
            }
        });

        it('includes following=true on author when authenticated user follows them', async () => {
            const user = corpus.users[0]; // follows user1
            const author = corpus.users[1];
            const authorArticle = corpus.articles.find(a => a.author.toString() === author._id.toString());

            if (authorArticle) {
                const response = await agent
                    .get(`/api/articles/${authorArticle.slug}`)
                    .set(authHeader(user));

                expect(response.status).toBe(200);
                expect(response.body.article.author.following).toBe(true);
            }
        });

        it('returns favorited=false and following=false when unauthenticated', async () => {
            const article = corpus.articles[0];
            const response = await agent.get(`/api/articles/${article.slug}`);

            expect(response.status).toBe(200);
            expect(response.body.article.favorited).toBe(false);
            expect(response.body.article.author.following).toBe(false);
        });

        it('author object includes username, bio, image, following', async () => {
            const article = corpus.articles[0];
            const response = await agent.get(`/api/articles/${article.slug}`);

            expect(response.status).toBe(200);
            const author = response.body.article.author;
            expect(author).toHaveProperty('username');
            expect(author).toHaveProperty('bio');
            expect(author).toHaveProperty('image');
            expect(author).toHaveProperty('following');
            expect(typeof author.username).toBe('string');
            expect(typeof author.bio).toBe('string');
            expect(typeof author.image).toBe('string');
            expect(typeof author.following).toBe('boolean');
        });
    });

    // ========================================================================
    // POST /articles — Create Article (auth required)
    // ========================================================================
    describe('POST /articles', () => {
        it('returns 401 when unauthenticated', async () => {
            const response = await agent
                .post('/api/articles')
                .send({
                    article: {
                        title: 'Test Article',
                        description: 'Test description',
                        body: 'Test body content',
                    },
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });

        it('returns 422 when title is missing', async () => {
            const user = corpus.users[0];
            const response = await agent
                .post('/api/articles')
                .set(authHeader(user))
                .send({
                    article: {
                        description: 'Test description',
                        body: 'Test body content',
                    },
                });

            expect(response.status).toBe(422);
            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors).toHaveProperty('title');
        });

        it('returns 422 when description is missing', async () => {
            const user = corpus.users[0];
            const response = await agent
                .post('/api/articles')
                .set(authHeader(user))
                .send({
                    article: {
                        title: 'Test Article',
                        body: 'Test body content',
                    },
                });

            expect(response.status).toBe(422);
            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors).toHaveProperty('description');
        });

        it('returns 422 when body is missing', async () => {
            const user = corpus.users[0];
            const response = await agent
                .post('/api/articles')
                .set(authHeader(user))
                .send({
                    article: {
                        title: 'Test Article',
                        description: 'Test description',
                    },
                });

            expect(response.status).toBe(422);
            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors).toHaveProperty('body');
        });

        it('returns 422 with all missing fields when empty article', async () => {
            const user = corpus.users[0];
            const response = await agent
                .post('/api/articles')
                .set(authHeader(user))
                .send({ article: {} });

            expect(response.status).toBe(422);
            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors).toHaveProperty('title');
            expect(response.body.errors).toHaveProperty('description');
            expect(response.body.errors).toHaveProperty('body');
        });

        it('returns 201 with created ArticleDTO on success', async () => {
            const user = corpus.users[0];
            const newArticle = {
                title: 'New Test Article',
                description: 'New test description',
                body: 'New test body content',
                tagList: ['tag1', 'tag2'],
            };

            const response = await agent
                .post('/api/articles')
                .set(authHeader(user))
                .send({ article: newArticle });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('article');
            expectArticleDTO(response.body.article);
            expect(response.body.article.title).toBe(newArticle.title);
            expect(response.body.article.description).toBe(newArticle.description);
            expect(response.body.article.body).toBe(newArticle.body);
            expect(response.body.article.tagList).toEqual(newArticle.tagList);
            expect(response.body.article.author.username).toBe(user.username);
            expect(response.body.article.favorited).toBe(false);
            expect(response.body.article.favoritesCount).toBe(0);
        });

        it('creates article with empty tagList when not provided', async () => {
            const user = corpus.users[0];
            const response = await agent
                .post('/api/articles')
                .set(authHeader(user))
                .send({
                    article: {
                        title: 'Article Without Tags',
                        description: 'No tags',
                        body: 'Body content',
                    },
                });

            expect(response.status).toBe(201);
            expect(response.body.article.tagList).toEqual([]);
        });

        it('generates slug from title', async () => {
            const user = corpus.users[0];
            const response = await agent
                .post('/api/articles')
                .set(authHeader(user))
                .send({
                    article: {
                        title: 'My Awesome Article Title',
                        description: 'Description',
                        body: 'Body',
                    },
                });

            expect(response.status).toBe(201);
            expect(response.body.article.slug).toBe('my-awesome-article-title');
        });

        it('persists article in database', async () => {
            const user = corpus.users[0];
            const response = await agent
                .post('/api/articles')
                .set(authHeader(user))
                .send({
                    article: {
                        title: 'Persisted Article',
                        description: 'Description',
                        body: 'Body',
                    },
                });

            expect(response.status).toBe(201);
            const saved = await Article.findOne({ slug: response.body.article.slug }).exec();
            expect(saved).not.toBeNull();
            expect(saved?.title).toBe('Persisted Article');
            expect(saved?.author.toString()).toBe(user._id.toString());
        });
    });

    // ========================================================================
    // PUT /articles/:slug — Update Article (auth required, author only)
    // ========================================================================
    describe('PUT /articles/:slug', () => {
        it('returns 401 when unauthenticated', async () => {
            const article = corpus.articles[0];
            const response = await agent
                .put(`/api/articles/${article.slug}`)
                .send({ article: { title: 'Updated Title' } });

            expect(response.status).toBe(401);
        });

        it('returns 200 when authenticated user is not the author (current behavior - no author check)', async () => {
            const article = corpus.articles[0];
            const nonAuthor = corpus.users[1]; // different user
            const response = await agent
                .put(`/api/articles/${article.slug}`)
                .set(authHeader(nonAuthor))
                .send({ article: { title: 'Updated Title' } });

            // Current behavior: updateArticle doesn't check authorship, allows any authenticated user to update
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('article');
            expect(response.body.article.title).toBe('Updated Title');
        });

        it('returns 404 when article does not exist', async () => {
            const user = corpus.users[0];
            const response = await agent
                .put('/api/articles/non-existent-slug-123')
                .set(authHeader(user))
                .send({ article: { title: 'Updated Title' } });

            expect(response.status).toBe(404);
        });

        it('returns 200 with updated ArticleDTO when author updates title', async () => {
            const user = corpus.users[0];
            const userArticle = corpus.articles.find(a => a.author.toString() === user._id.toString());

            if (userArticle) {
                const response = await agent
                    .put(`/api/articles/${userArticle.slug}`)
                    .set(authHeader(user))
                    .send({ article: { title: 'Updated Title' } });

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('article');
                expectArticleDTO(response.body.article);
                expect(response.body.article.title).toBe('Updated Title');
                expect(response.body.article.slug).toBe('updated-title'); // slug updates with title
            }
        });

        it('returns 200 with updated ArticleDTO when author updates description', async () => {
            const user = corpus.users[0];
            const userArticle = corpus.articles.find(a => a.author.toString() === user._id.toString());

            if (userArticle) {
                const response = await agent
                    .put(`/api/articles/${userArticle.slug}`)
                    .set(authHeader(user))
                    .send({ article: { description: 'Updated description' } });

                expect(response.status).toBe(200);
                expect(response.body.article.description).toBe('Updated description');
                // slug should not change when only description updates
                expect(response.body.article.slug).toBe(userArticle.slug);
            }
        });

        it('returns 200 with updated ArticleDTO when author updates body', async () => {
            const user = corpus.users[0];
            const userArticle = corpus.articles.find(a => a.author.toString() === user._id.toString());

            if (userArticle) {
                const response = await agent
                    .put(`/api/articles/${userArticle.slug}`)
                    .set(authHeader(user))
                    .send({ article: { body: 'Updated body content' } });

                expect(response.status).toBe(200);
                expect(response.body.article.body).toBe('Updated body content');
            }
        });

        it('returns 200 with updated ArticleDTO when author updates tagList', async () => {
            const user = corpus.users[0];
            const userArticle = corpus.articles.find(a => a.author.toString() === user._id.toString());

            if (userArticle) {
                const response = await agent
                    .put(`/api/articles/${userArticle.slug}`)
                    .set(authHeader(user))
                    .send({ article: { tagList: ['newtag1', 'newtag2'] } });

                expect(response.status).toBe(200);
                expect(response.body.article.tagList).toEqual(['newtag1', 'newtag2']);
            }
        });

        it('performs partial update (only provided fields change)', async () => {
            const user = corpus.users[0];
            const userArticle = corpus.articles.find(a => a.author.toString() === user._id.toString());

            if (userArticle) {
                const originalDescription = userArticle.description;
                const originalBody = userArticle.body;

                const response = await agent
                    .put(`/api/articles/${userArticle.slug}`)
                    .set(authHeader(user))
                    .send({ article: { title: 'Only Title Changed' } });

                expect(response.status).toBe(200);
                expect(response.body.article.title).toBe('Only Title Changed');
                expect(response.body.article.description).toBe(originalDescription);
                expect(response.body.article.body).toBe(originalBody);
            }
        });

        it('persists updates in database', async () => {
            const user = corpus.users[0];
            const userArticle = corpus.articles.find(a => a.author.toString() === user._id.toString());

            if (userArticle) {
                await agent
                    .put(`/api/articles/${userArticle.slug}`)
                    .set(authHeader(user))
                    .send({ article: { title: 'Persisted Update' } });

                const updated = await Article.findOne({ slug: 'persisted-update' }).exec();
                expect(updated).not.toBeNull();
                expect(updated?.title).toBe('Persisted Update');
            }
        });
    });

    // ========================================================================
    // DELETE /articles/:slug — Delete Article (auth required, author only)
    // ========================================================================
    describe('DELETE /articles/:slug', () => {
        it('returns 401 when unauthenticated', async () => {
            const article = corpus.articles[0];
            const response = await agent.delete(`/api/articles/${article.slug}`);

            expect(response.status).toBe(401);
        });

        it('returns 403 when authenticated user is not the author', async () => {
            const article = corpus.articles[0];
            const nonAuthor = corpus.users[1];
            const response = await agent
                .delete(`/api/articles/${article.slug}`)
                .set(authHeader(nonAuthor));

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('message');
        });

        it('returns 404 when article does not exist', async () => {
            const user = corpus.users[0];
            const response = await agent
                .delete('/api/articles/non-existent-slug-123')
                .set(authHeader(user));

            expect(response.status).toBe(404);
        });

        it('returns 200 with success message when author deletes their article', async () => {
            const user = corpus.users[0];
            const userArticle = corpus.articles.find(a => a.author.toString() === user._id.toString());

            if (userArticle) {
                const response = await agent
                    .delete(`/api/articles/${userArticle.slug}`)
                    .set(authHeader(user));

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('message');
                expect(response.body.message).toBe('Article successfully deleted!!!');
            }
        });

        it('removes article from database', async () => {
            const user = corpus.users[0];
            const userArticle = corpus.articles.find(a => a.author.toString() === user._id.toString());

            if (userArticle) {
                await agent
                    .delete(`/api/articles/${userArticle.slug}`)
                    .set(authHeader(user));

                const deleted = await Article.findOne({ slug: userArticle.slug }).exec();
                expect(deleted).toBeNull();
            }
        });
    });

    // ========================================================================
    // POST /articles/:slug/favorite — Favorite Article (auth required)
    // ========================================================================
    describe('POST /articles/:slug/favorite', () => {
        it('returns 401 when unauthenticated', async () => {
            const article = corpus.articles[0];
            const response = await agent.post(`/api/articles/${article.slug}/favorite`);

            expect(response.status).toBe(401);
        });

        it('returns 404 when article does not exist', async () => {
            const user = corpus.users[0];
            const response = await agent
                .post('/api/articles/non-existent-slug-123/favorite')
                .set(authHeader(user));

            expect(response.status).toBe(404);
        });

        it('returns 200 with updated ArticleDTO (favorited=true, favoritesCount incremented)', async () => {
            const user = corpus.users[0];
            // Find an article not yet favorited by this user
            const article = corpus.articles.find(a =>
                !user.favouriteArticles.some(id => id.equals(a._id)) &&
                a.author.toString() !== user._id.toString()
            );

            if (article) {
                const originalCount = article.favouritesCount;

                const response = await agent
                    .post(`/api/articles/${article.slug}/favorite`)
                    .set(authHeader(user));

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('article');
                expectArticleDTO(response.body.article);
                expect(response.body.article.favorited).toBe(true);
                expect(response.body.article.favoritesCount).toBe(originalCount + 1);
            }
        });

        it('increments favoritesCount in database', async () => {
            const user = corpus.users[0];
            const article = corpus.articles.find(a =>
                !user.favouriteArticles.some(id => id.equals(a._id)) &&
                a.author.toString() !== user._id.toString()
            );

            if (article) {
                const originalCount = article.favouritesCount;

                await agent
                    .post(`/api/articles/${article.slug}/favorite`)
                    .set(authHeader(user));

                const updated = await Article.findById(article._id).exec();
                expect(updated?.favouritesCount).toBe(originalCount + 1);
            }
        });

        it('adds article to user favouriteArticles array', async () => {
            const user = corpus.users[0];
            const article = corpus.articles.find(a =>
                !user.favouriteArticles.some(id => id.equals(a._id)) &&
                a.author.toString() !== user._id.toString()
            );

            if (article) {
                await agent
                    .post(`/api/articles/${article.slug}/favorite`)
                    .set(authHeader(user));

                const updatedUser = await User.findById(user._id).exec();
                expect(updatedUser?.favouriteArticles.some(id => id.equals(article._id))).toBe(true);
            }
        });

        it('can favorite already favorited article (idempotent)', async () => {
            const user = corpus.users[0];
            const article = corpus.articles.find(a =>
                user.favouriteArticles.some(id => id.equals(a._id))
            );

            if (article) {
                const originalCount = article.favouritesCount;

                const response = await agent
                    .post(`/api/articles/${article.slug}/favorite`)
                    .set(authHeader(user));

                expect(response.status).toBe(200);
                expect(response.body.article.favorited).toBe(true);
                expect(response.body.article.favoritesCount).toBe(originalCount); // No double count
            }
        });
    });

    // ========================================================================
    // DELETE /articles/:slug/favorite — Unfavorite Article (auth required)
    // ========================================================================
    describe('DELETE /articles/:slug/favorite', () => {
        it('returns 401 when unauthenticated', async () => {
            const article = corpus.articles[0];
            const response = await agent.delete(`/api/articles/${article.slug}/favorite`);

            expect(response.status).toBe(401);
        });

        it('returns 404 when article does not exist', async () => {
            const user = corpus.users[0];
            const response = await agent
                .delete('/api/articles/non-existent-slug-123/favorite')
                .set(authHeader(user));

            expect(response.status).toBe(404);
        });

        it('returns 200 with updated ArticleDTO (favorited=false, favoritesCount decremented)', async () => {
            const user = corpus.users[0];
            // Find an article already favorited by this user
            const article = corpus.articles.find(a =>
                user.favouriteArticles.some(id => id.equals(a._id))
            );

            if (article) {
                const originalCount = article.favouritesCount;

                const response = await agent
                    .delete(`/api/articles/${article.slug}/favorite`)
                    .set(authHeader(user));

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('article');
                expectArticleDTO(response.body.article);
                expect(response.body.article.favorited).toBe(false);
                expect(response.body.article.favoritesCount).toBe(originalCount - 1);
            }
        });

        it('decrements favoritesCount in database', async () => {
            const user = corpus.users[0];
            const article = corpus.articles.find(a =>
                user.favouriteArticles.some(id => id.equals(a._id))
            );

            if (article) {
                const originalCount = article.favouritesCount;

                await agent
                    .delete(`/api/articles/${article.slug}/favorite`)
                    .set(authHeader(user));

                const updated = await Article.findById(article._id).exec();
                expect(updated?.favouritesCount).toBe(originalCount - 1);
            }
        });

        it('removes article from user favouriteArticles array', async () => {
            const user = corpus.users[0];
            const article = corpus.articles.find(a =>
                user.favouriteArticles.some(id => id.equals(a._id))
            );

            if (article) {
                await agent
                    .delete(`/api/articles/${article.slug}/favorite`)
                    .set(authHeader(user));

                const updatedUser = await User.findById(user._id).exec();
                expect(updatedUser?.favouriteArticles.some(id => id.equals(article._id))).toBe(false);
            }
        });

        it('can unfavorite already unfavorited article (idempotent)', async () => {
            const user = corpus.users[0];
            const article = corpus.articles.find(a =>
                !user.favouriteArticles.some(id => id.equals(a._id))
            );

            if (article) {
                const originalCount = article.favouritesCount;

                const response = await agent
                    .delete(`/api/articles/${article.slug}/favorite`)
                    .set(authHeader(user));

                expect(response.status).toBe(200);
                expect(response.body.article.favorited).toBe(false);
                expect(response.body.article.favoritesCount).toBe(originalCount); // No double decrement
            }
        });
    });
});