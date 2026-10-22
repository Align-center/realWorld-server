import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import createTestAgent from '../utils/test-app';
import { seedUser, authHeader } from '../utils/fixtures';
import User from '@/models/User';
import type { IUser } from '@/models/User';

// ============================================================================
// PROFILE DTO INTERFACE
// ============================================================================

interface ProfileDTO {
    username: string;
    bio: string;
    image: string;
    following: boolean;
}

// ============================================================================
// ERROR MESSAGE CONSTANTS
// ============================================================================

const ERROR_USER_NOT_FOUND = 'User Not Found';

// ============================================================================
// CORPUS FIXTURE: Users with follow relationships
// ============================================================================

const USERS_COUNT = 10;

interface Corpus {
    users: IUser[];
}

let corpus: Corpus;
let agent: ReturnType<typeof createTestAgent>;

async function buildCorpus(): Promise<Corpus> {
    // Create 10 users with distinct usernames, emails, bios, and images
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

    // Create follow relationships: user0 follows user1; user1 follows user2; etc.
    for (let i = 0; i < USERS_COUNT - 1; i++) {
        await users[i].follow(users[i + 1]._id);
    }
    // user9 follows user0 (circular)
    await users[USERS_COUNT - 1].follow(users[0]._id);

    return { users };
}

describe('ProfileModule — HTTP Characterization Tests', () => {
    beforeAll(async () => {
        agent = createTestAgent();
        corpus = await buildCorpus();
    }, 120000);

    beforeEach(async () => {
        // Rebuild corpus for test isolation
        // The setup.ts beforeEach clears collections, so we need to rebuild
        corpus = await buildCorpus();
    }, 120000);

    // ========================================================================
    // HELPER: Validate ProfileDTO shape
    // ========================================================================
    const expectProfileDTO = (profile: ProfileDTO) => {
        expect(profile).toHaveProperty('username');
        expect(profile).toHaveProperty('bio');
        expect(profile).toHaveProperty('image');
        expect(profile).toHaveProperty('following');
        expect(typeof profile.username).toBe('string');
        expect(typeof profile.bio).toBe('string');
        expect(typeof profile.image).toBe('string');
        expect(typeof profile.following).toBe('boolean');
    };

    // ========================================================================
    // GET /profiles/:username — Get Profile (auth optional)
    // ========================================================================
    describe('GET /profiles/:username', () => {
        it('returns 200 with ProfileDTO when user exists (unauthenticated)', async () => {
            const targetUser = corpus.users[0];
            const response = await agent.get(`/api/profiles/${targetUser.username}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('profile');
            expectProfileDTO(response.body.profile);
            expect(response.body.profile.username).toBe(targetUser.username);
            expect(response.body.profile.bio).toBe(targetUser.bio);
            expect(response.body.profile.image).toBe(targetUser.image);
            expect(response.body.profile.following).toBe(false);
        });

        it('returns 200 with ProfileDTO when user exists (authenticated)', async () => {
            const targetUser = corpus.users[0];
            const viewer = corpus.users[1]; // viewer does NOT follow user0
            const response = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('profile');
            expectProfileDTO(response.body.profile);
            expect(response.body.profile.username).toBe(targetUser.username);
            expect(response.body.profile.following).toBe(false);
        });

        it('returns following=true when authenticated viewer follows the target user', async () => {
            const targetUser = corpus.users[1]; // user1
            const viewer = corpus.users[0]; // user0 follows user1
            const response = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));

            expect(response.status).toBe(200);
            expect(response.body.profile.following).toBe(true);
        });

        it('returns following=false when authenticated viewer does not follow the target user', async () => {
            const targetUser = corpus.users[2]; // user2
            const viewer = corpus.users[0]; // user0 follows user1, not user2
            const response = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));

            expect(response.status).toBe(200);
            expect(response.body.profile.following).toBe(false);
        });

        it('returns 404 when user does not exist', async () => {
            const response = await agent.get('/api/profiles/nonexistentuser123');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe(ERROR_USER_NOT_FOUND);
        });

        it('returns 404 when user does not exist (authenticated)', async () => {
            const viewer = corpus.users[0];
            const response = await agent
                .get('/api/profiles/nonexistentuser123')
                .set(authHeader(viewer));

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe(ERROR_USER_NOT_FOUND);
        });

        it('returns ProfileDTO with correct fields: username, bio, image, following', async () => {
            const targetUser = corpus.users[0];
            const response = await agent.get(`/api/profiles/${targetUser.username}`);

            expect(response.status).toBe(200);
            const profile = response.body.profile;
            expect(profile.username).toBe(targetUser.username);
            expect(profile.bio).toBe(targetUser.bio);
            expect(profile.image).toBe(targetUser.image);
            expect(typeof profile.following).toBe('boolean');
        });

        it('returns default image URL when user has no custom image', async () => {
            // Create a user without specifying an image (uses default)
            const user = await seedUser({
                username: 'defaultimage',
                email: 'default@example.com',
                bio: 'Default image user',
                // image not provided - should use default
            });

            const response = await agent.get(`/api/profiles/${user.username}`);

            expect(response.status).toBe(200);
            expect(response.body.profile.image).toBe('https://static.productionready.io/images/smiley-cyrus.jpg');
        });
    });

    // ========================================================================
    // POST /profiles/:username/follow — Follow User (auth required)
    // ========================================================================
    describe('POST /profiles/:username/follow', () => {
        it('returns 401 when unauthenticated', async () => {
            const targetUser = corpus.users[0];
            const response = await agent.post(`/api/profiles/${targetUser.username}/follow`);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });

        it('returns 404 when target user does not exist', async () => {
            const viewer = corpus.users[0];
            const response = await agent
                .post('/api/profiles/nonexistentuser123/follow')
                .set(authHeader(viewer));

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe(ERROR_USER_NOT_FOUND);
        });

        it('returns 200 with updated ProfileDTO (following=true) when following a user', async () => {
            const targetUser = corpus.users[2]; // user2 (not followed by user0)
            const viewer = corpus.users[0]; // user0 follows user1, not user2
            const response = await agent
                .post(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('profile');
            expectProfileDTO(response.body.profile);
            expect(response.body.profile.username).toBe(targetUser.username);
            expect(response.body.profile.following).toBe(true);
        });

        it('persists follow relationship in database', async () => {
            const targetUser = corpus.users[2]; // user2
            const viewer = corpus.users[0]; // user0

            await agent
                .post(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            const updatedViewer = await User.findById(viewer._id).exec();
            expect(updatedViewer?.followingUsers.some(id => id.equals(targetUser._id))).toBe(true);
        });

        it('returns following=true when already following the user (idempotent)', async () => {
            const targetUser = corpus.users[1]; // user1 (already followed by user0)
            const viewer = corpus.users[0];
            const response = await agent
                .post(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            expect(response.status).toBe(200);
            expect(response.body.profile.following).toBe(true);
        });

        it('does not duplicate follow relationship in database when already following', async () => {
            const targetUser = corpus.users[1]; // user1 (already followed by user0)
            const viewer = corpus.users[0];

            // Get initial follow count
            const viewerBefore = await User.findById(viewer._id).exec();
            const initialFollowCount = viewerBefore?.followingUsers.length ?? 0;

            await agent
                .post(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            const viewerAfter = await User.findById(viewer._id).exec();
            expect(viewerAfter?.followingUsers.length).toBe(initialFollowCount);
        });

        it('different users can follow the same target user', async () => {
            const targetUser = corpus.users[2]; // user2
            const viewer1 = corpus.users[0];
            const viewer2 = corpus.users[3]; // user3 follows user4, not user2

            const response1 = await agent
                .post(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer1));

            const response2 = await agent
                .post(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer2));

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
            expect(response1.body.profile.following).toBe(true);
            expect(response2.body.profile.following).toBe(true);

            // Verify both viewers now follow the target user
            const updatedViewer1 = await User.findById(viewer1._id).exec();
            const updatedViewer2 = await User.findById(viewer2._id).exec();
            expect(updatedViewer1?.followingUsers.some(id => id.equals(targetUser._id))).toBe(true);
            expect(updatedViewer2?.followingUsers.some(id => id.equals(targetUser._id))).toBe(true);
        });

        it('cannot follow yourself (current behavior allows it)', async () => {
            const viewer = corpus.users[0];
            const response = await agent
                .post(`/api/profiles/${viewer.username}/follow`)
                .set(authHeader(viewer));

            // Current implementation allows self-follow, so expect 200
            expect(response.status).toBe(200);
            expect(response.body.profile.following).toBe(true);
        });
    });

    // ========================================================================
    // DELETE /profiles/:username/follow — Unfollow User (auth required)
    // ========================================================================
    describe('DELETE /profiles/:username/follow', () => {
        it('returns 401 when unauthenticated', async () => {
            const targetUser = corpus.users[0];
            const response = await agent.delete(`/api/profiles/${targetUser.username}/follow`);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });

        it('returns 404 when target user does not exist', async () => {
            const viewer = corpus.users[0];
            const response = await agent
                .delete('/api/profiles/nonexistentuser123/follow')
                .set(authHeader(viewer));

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe(ERROR_USER_NOT_FOUND);
        });

        it('returns 200 with updated ProfileDTO (following=false) when unfollowing a user', async () => {
            const targetUser = corpus.users[1]; // user1 (followed by user0)
            const viewer = corpus.users[0];
            const response = await agent
                .delete(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('profile');
            expectProfileDTO(response.body.profile);
            expect(response.body.profile.username).toBe(targetUser.username);
            expect(response.body.profile.following).toBe(false);
        });

        it('removes follow relationship from database', async () => {
            const targetUser = corpus.users[1]; // user1 (followed by user0)
            const viewer = corpus.users[0];

            await agent
                .delete(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            const updatedViewer = await User.findById(viewer._id).exec();
            expect(updatedViewer?.followingUsers.some(id => id.equals(targetUser._id))).toBe(false);
        });

        it('returns following=false when already not following the user (idempotent)', async () => {
            const targetUser = corpus.users[2]; // user2 (not followed by user0)
            const viewer = corpus.users[0];
            const response = await agent
                .delete(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            expect(response.status).toBe(200);
            expect(response.body.profile.following).toBe(false);
        });

        it('does not error when unfollowing user not being followed', async () => {
            const targetUser = corpus.users[2]; // user2 (not followed by user0)
            const viewer = corpus.users[0];

            // Get initial follow count
            const viewerBefore = await User.findById(viewer._id).exec();
            const initialFollowCount = viewerBefore?.followingUsers.length ?? 0;

            await agent
                .delete(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            const viewerAfter = await User.findById(viewer._id).exec();
            expect(viewerAfter?.followingUsers.length).toBe(initialFollowCount);
        });

        it('unfollow updates following status correctly for subsequent GET /profiles', async () => {
            const targetUser = corpus.users[1]; // user1 (followed by user0)
            const viewer = corpus.users[0];

            // First unfollow
            await agent
                .delete(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            // Then GET profile - should show following=false
            const response = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));

            expect(response.status).toBe(200);
            expect(response.body.profile.following).toBe(false);
        });

        it('follow then unfollow returns to following=false', async () => {
            const targetUser = corpus.users[2]; // user2 (not followed by user0)
            const viewer = corpus.users[0];

            // Follow first
            await agent
                .post(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            // Then unfollow
            const unfollowResponse = await agent
                .delete(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            expect(unfollowResponse.status).toBe(200);
            expect(unfollowResponse.body.profile.following).toBe(false);

            // Verify GET profile shows following=false
            const getResponse = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));

            expect(getResponse.body.profile.following).toBe(false);
        });
    });

    // ========================================================================
    // Cross-endpoint consistency checks
    // ========================================================================
    describe('Cross-endpoint consistency', () => {
        it('GET /profiles reflects follow/unfollow state changes', async () => {
            const targetUser = corpus.users[2]; // user2 (not followed by user0)
            const viewer = corpus.users[0];

            // Initial state: not following
            let getResponse = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));
            expect(getResponse.body.profile.following).toBe(false);

            // Follow
            await agent
                .post(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            // Verify following=true
            getResponse = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));
            expect(getResponse.body.profile.following).toBe(true);

            // Unfollow
            await agent
                .delete(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            // Verify following=false
            getResponse = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));
            expect(getResponse.body.profile.following).toBe(false);
        });

        it('POST follow returns ProfileDTO matching GET profile after follow', async () => {
            const targetUser = corpus.users[2]; // user2
            const viewer = corpus.users[0];

            const followResponse = await agent
                .post(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            const getResponse = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));

            expect(followResponse.body.profile).toEqual(getResponse.body.profile);
        });

        it('DELETE unfollow returns ProfileDTO matching GET profile after unfollow', async () => {
            const targetUser = corpus.users[1]; // user1 (followed by user0)
            const viewer = corpus.users[0];

            const unfollowResponse = await agent
                .delete(`/api/profiles/${targetUser.username}/follow`)
                .set(authHeader(viewer));

            const getResponse = await agent
                .get(`/api/profiles/${targetUser.username}`)
                .set(authHeader(viewer));

            expect(unfollowResponse.body.profile).toEqual(getResponse.body.profile);
        });
    });
});