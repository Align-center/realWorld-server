import { describe, it, expect, beforeEach } from 'vitest';
import createTestAgent from '../utils/test-app';
import { seedUser, seedArticle } from '../utils/fixtures';

describe('GET /api/tags - Characterization Tests', () => {
    const agent = createTestAgent();

    beforeEach(async () => {
        // Clean up is handled by setup.ts beforeEach
    });

    it('should return empty tags array when no articles exist', async () => {
        const response = await agent.get('/api/tags');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('tags');
        expect(Array.isArray(response.body.tags)).toBe(true);
        expect(response.body.tags).toEqual([]);
    });

    it('should return distinct tags from all articles', async () => {
        const user = await seedUser({ username: 'taguser', email: 'tags@example.com' });

        // Create articles with overlapping tags
        await seedArticle({
            title: 'Article 1',
            tagList: ['javascript', 'react', 'testing'],
            author: user
        });
        await seedArticle({
            title: 'Article 2',
            tagList: ['react', 'vue', 'frontend'],
            author: user
        });
        await seedArticle({
            title: 'Article 3',
            tagList: ['javascript', 'nodejs', 'backend'],
            author: user
        });

        const response = await agent.get('/api/tags');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('tags');
        expect(Array.isArray(response.body.tags)).toBe(true);

        // Should contain all distinct tags
        const expectedTags = ['javascript', 'react', 'testing', 'vue', 'frontend', 'nodejs', 'backend'];
        expect(response.body.tags.sort()).toEqual(expectedTags.sort());
    });

    it('should not return duplicate tags', async () => {
        const user = await seedUser({ username: 'duptest', email: 'dup@example.com' });

        // Create multiple articles with same tags
        await seedArticle({
            title: 'Article 1',
            tagList: ['tag1', 'tag2'],
            author: user
        });
        await seedArticle({
            title: 'Article 2',
            tagList: ['tag1', 'tag2'],
            author: user
        });
        await seedArticle({
            title: 'Article 3',
            tagList: ['tag1'],
            author: user
        });

        const response = await agent.get('/api/tags');

        expect(response.status).toBe(200);
        expect(response.body.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle articles with empty tagList', async () => {
        const user = await seedUser({ username: 'emptytag', email: 'empty@example.com' });

        await seedArticle({
            title: 'Article with tags',
            tagList: ['tag1', 'tag2'],
            author: user
        });
        await seedArticle({
            title: 'Article without tags',
            tagList: [],
            author: user
        });

        const response = await agent.get('/api/tags');

        expect(response.status).toBe(200);
        expect(response.body.tags).toEqual(['tag1', 'tag2']);
    });

    it('should return tags in alphabetical order', async () => {
        const user = await seedUser({ username: 'sorttest', email: 'sort@example.com' });

        await seedArticle({
            title: 'Article 1',
            tagList: ['zeta', 'alpha', 'gamma'],
            author: user
        });

        const response = await agent.get('/api/tags');

        expect(response.status).toBe(200);
        expect(response.body.tags).toEqual(['alpha', 'gamma', 'zeta']);
    });
});