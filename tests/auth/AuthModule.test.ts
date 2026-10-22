import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '@/models/User';
import { AuthModule } from '@/src/modules/auth/AuthModule';
import { InMemoryTokenAdapter } from '@/src/modules/auth/ports/TokenPort';
import { ValidationError, NotFoundError, UnauthorizedError, ConflictError } from '@/src/shared/errors/AppError';

const TEST_PASSWORD = 'password123';
let HASHED_PASSWORD: string;

beforeAll(async () => {
    HASHED_PASSWORD = await bcrypt.hash(TEST_PASSWORD, 10);
});

function createTestUser(overrides: Partial<{ username: string; email: string; bio: string; image: string }> = {}) {
    return User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: HASHED_PASSWORD,
        bio: '',
        image: 'https://static.productionready.io/images/smiley-cyrus.jpg',
        ...overrides,
    });
}

describe('AuthModule', () => {
    let authModule: AuthModule;
    let tokenAdapter: InMemoryTokenAdapter;

    beforeEach(async () => {
        tokenAdapter = new InMemoryTokenAdapter();
        authModule = new AuthModule(User, tokenAdapter);
        await User.deleteMany({});
    });

    describe('register', () => {
        it('should register a new user and return UserDTO with token', async () => {
            const result = await authModule.register({
                email: 'test@example.com',
                username: 'testuser',
                password: TEST_PASSWORD,
            });

            expect(result).toMatchObject({
                username: 'testuser',
                email: 'test@example.com',
                bio: '',
                image: 'https://static.productionready.io/images/smiley-cyrus.jpg',
            });
            expect(result.token).toBeDefined();
            expect(typeof result.token).toBe('string');
            expect(result.token).toMatch(/^test-token-/);
        });

        it('should hash the password and not store plain text', async () => {
            await authModule.register({
                email: 'test@example.com',
                username: 'testuser',
                password: TEST_PASSWORD,
            });

            const user = await User.findOne({ email: 'test@example.com' }).exec();
            expect(user).not.toBeNull();
            expect(user!.password).not.toBe(TEST_PASSWORD);
            expect(user!.password.length).toBeGreaterThan(20);
        });

        it('should reject duplicate email', async () => {
            await authModule.register({
                email: 'test@example.com',
                username: 'testuser1',
                password: TEST_PASSWORD,
            });

            await expect(authModule.register({
                email: 'test@example.com',
                username: 'testuser2',
                password: 'password456',
            })).rejects.toThrow(ConflictError);
        });

        it('should reject duplicate username', async () => {
            await authModule.register({
                email: 'test1@example.com',
                username: 'testuser',
                password: TEST_PASSWORD,
            });

            await expect(authModule.register({
                email: 'test2@example.com',
                username: 'testuser',
                password: 'password456',
            })).rejects.toThrow(ConflictError);
        });

        it('should reject missing email', async () => {
            await expect(authModule.register({
                username: 'testuser',
                password: TEST_PASSWORD,
            } as any)).rejects.toThrow(ValidationError);
        });

        it('should reject missing username', async () => {
            await expect(authModule.register({
                email: 'test@example.com',
                password: TEST_PASSWORD,
            } as any)).rejects.toThrow(ValidationError);
        });

        it('should reject missing password', async () => {
            await expect(authModule.register({
                email: 'test@example.com',
                username: 'testuser',
            } as any)).rejects.toThrow(ValidationError);
        });
    });

    describe('login', () => {
        beforeEach(async () => {
            await createTestUser();
        });

        it('should login successfully and return UserDTO with token', async () => {
            const result = await authModule.login({
                email: 'test@example.com',
                password: TEST_PASSWORD,
            });

            expect(result).toMatchObject({
                username: 'testuser',
                email: 'test@example.com',
                bio: '',
                image: 'https://static.productionready.io/images/smiley-cyrus.jpg',
            });
            expect(result.token).toBeDefined();
            expect(typeof result.token).toBe('string');
        });

        it('should reject invalid email', async () => {
            await expect(authModule.login({
                email: 'nonexistent@example.com',
                password: TEST_PASSWORD,
            })).rejects.toThrow(NotFoundError);
        });

        it('should reject invalid password', async () => {
            await expect(authModule.login({
                email: 'test@example.com',
                password: 'wrongpassword',
            })).rejects.toThrow(UnauthorizedError);
        });

        it('should reject missing email', async () => {
            await expect(authModule.login({
                password: TEST_PASSWORD,
            } as any)).rejects.toThrow(ValidationError);
        });

        it('should reject missing password', async () => {
            await expect(authModule.login({
                email: 'test@example.com',
            } as any)).rejects.toThrow(ValidationError);
        });
    });

    describe('getCurrentUser', () => {
        let userId: string;

        beforeEach(async () => {
            const user = await createTestUser({
                bio: 'Test bio',
                image: 'https://example.com/image.jpg',
            });
            userId = user._id.toString();
        });

        it('should return UserDTO with token', async () => {
            const result = await authModule.getCurrentUser(userId);

            expect(result).toMatchObject({
                username: 'testuser',
                email: 'test@example.com',
                bio: 'Test bio',
                image: 'https://example.com/image.jpg',
            });
            expect(result.token).toBeDefined();
        });

        it('should reject non-existent user', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            await expect(authModule.getCurrentUser(nonExistentId)).rejects.toThrow(NotFoundError);
        });
    });

    describe('updateUser', () => {
        let userId: string;

        beforeEach(async () => {
            const user = await createTestUser({
                bio: 'Original bio',
                image: 'https://example.com/original.jpg',
            });
            userId = user._id.toString();
        });

        it('should update username', async () => {
            const result = await authModule.updateUser(userId, { username: 'newusername' });

            expect(result.username).toBe('newusername');
            expect(result.email).toBe('test@example.com');
            expect(result.bio).toBe('Original bio');
        });

        it('should update email', async () => {
            const result = await authModule.updateUser(userId, { email: 'new@example.com' });

            expect(result.email).toBe('new@example.com');
            expect(result.username).toBe('testuser');
        });

        it('should update bio', async () => {
            const result = await authModule.updateUser(userId, { bio: 'Updated bio' });

            expect(result.bio).toBe('Updated bio');
        });

        it('should update image', async () => {
            const result = await authModule.updateUser(userId, { image: 'https://example.com/new.jpg' });

            expect(result.image).toBe('https://example.com/new.jpg');
        });

        it('should update password and hash it', async () => {
            const result = await authModule.updateUser(userId, { password: 'newpassword123' });

            expect(result.username).toBe('testuser');
            const user = await User.findById(userId).exec();
            expect(user!.password).not.toBe('newpassword123');
        });

        it('should update multiple fields at once', async () => {
            const result = await authModule.updateUser(userId, {
                username: 'multiuser',
                bio: 'Multi bio',
                image: 'https://example.com/multi.jpg',
            });

            expect(result.username).toBe('multiuser');
            expect(result.bio).toBe('Multi bio');
            expect(result.image).toBe('https://example.com/multi.jpg');
            expect(result.email).toBe('test@example.com');
        });

        it('should reject non-existent user', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            await expect(authModule.updateUser(nonExistentId, { username: 'new' })).rejects.toThrow(NotFoundError);
        });

        it('should reject duplicate username on update', async () => {
            await createTestUser({ username: 'otheruser', email: 'other@example.com' });

            await expect(authModule.updateUser(userId, { username: 'otheruser' })).rejects.toThrow(ConflictError);
        });

        it('should reject duplicate email on update', async () => {
            await createTestUser({ username: 'otheruser', email: 'other@example.com' });

            await expect(authModule.updateUser(userId, { email: 'other@example.com' })).rejects.toThrow(ConflictError);
        });
    });
});