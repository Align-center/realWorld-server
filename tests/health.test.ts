import { describe, it, expect } from 'vitest';
import createTestAgent from './utils/test-app';
import { seedUser, authHeader } from './utils/fixtures';

describe('Test Infrastructure', () => {
    it('should respond to test route', async () => {
        const agent = createTestAgent();
        const response = await agent.get('/test');
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('successful');
    });

    it('should create and authenticate a user', async () => {
        const user = await seedUser({ username: 'testuser', email: 'test@example.com' });
        expect(user.username).toBe('testuser');
        expect(user.email).toBe('test@example.com');
        expect(user.password).toBeDefined();

        const token = user.generateAccessToken();
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
    });

    it('should authenticate requests with auth header', async () => {
        const user = await seedUser({ username: 'authtest', email: 'auth@example.com' });
        const agent = createTestAgent();

        const response = await agent
            .get('/api/user')
            .set(authHeader(user));

        expect(response.status).toBe(200);
        expect(response.body.user.username).toBe('authtest');
    });
});