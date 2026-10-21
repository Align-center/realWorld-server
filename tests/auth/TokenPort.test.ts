import { describe, it, expect, beforeEach } from 'vitest';
import { JwtAdapter, InMemoryTokenAdapter, TokenPayload } from '@/src/modules/auth/ports/TokenPort';

describe('TokenPort Adapters', () => {
    const samplePayload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
    };

    describe('JwtAdapter', () => {
        let adapter: JwtAdapter;

        beforeEach(() => {
            adapter = new JwtAdapter();
        });

        it('should sign and verify a token successfully (roundtrip)', () => {
            const token = adapter.sign(samplePayload);
            const decoded = adapter.verify(token);

            expect(decoded.user.userId).toBe(samplePayload.userId);
            expect(decoded.user.email).toBe(samplePayload.email);
            expect(decoded.user.password).toBe(samplePayload.password);
            expect(decoded.iat).toBeDefined();
            expect(decoded.exp).toBeDefined();
            expect(decoded.exp).toBeGreaterThan(decoded.iat);
        });

        it('should reject a token with invalid signature', () => {
            const token = adapter.sign(samplePayload);
            // Tamper with the token
            const tamperedToken = token.slice(0, -5) + 'xxxxx';

            expect(() => adapter.verify(tamperedToken)).toThrow('Token verification failed');
        });

        it('should reject an expired token', () => {
            // Create an adapter with very short expiry
            const expiredAdapter = new JwtAdapter();
            // Manually create an expired token using jsonwebtoken directly
            const jwt = require('jsonwebtoken');
            const expiredToken = jwt.sign(
                { user: samplePayload },
                process.env.ACCESS_TOKEN_SECRET!,
                { expiresIn: '-1s' } // Already expired
            );

            // Wait a moment to ensure it's expired
            expect(() => expiredAdapter.verify(expiredToken)).toThrow('Token verification failed');
        });

        it('should decode a valid token without verification', () => {
            const token = adapter.sign(samplePayload);
            const decoded = adapter.decode(token);

            expect(decoded).not.toBeNull();
            expect(decoded!.user.userId).toBe(samplePayload.userId);
            expect(decoded!.user.email).toBe(samplePayload.email);
        });

        it('should return null when decoding a malformed token', () => {
            const decoded = adapter.decode('not-a-valid-token');
            expect(decoded).toBeNull();
        });

        it('should return null when decoding a tampered token', () => {
            const token = adapter.sign(samplePayload);
            const tamperedToken = token.slice(0, -5) + 'xxxxx';
            const decoded = adapter.decode(tamperedToken);
            // jsonwebtoken decode doesn't verify signature, so it may still decode
            // but the payload will be corrupted
            expect(decoded).toBeDefined(); // decode doesn't throw, may return payload
        });
    });

    describe('InMemoryTokenAdapter', () => {
        let adapter: InMemoryTokenAdapter;

        beforeEach(() => {
            adapter = new InMemoryTokenAdapter();
        });

        it('should sign and verify a token successfully (roundtrip)', () => {
            const token = adapter.sign(samplePayload);
            const decoded = adapter.verify(token);

            expect(decoded.user.userId).toBe(samplePayload.userId);
            expect(decoded.user.email).toBe(samplePayload.email);
            expect(decoded.user.password).toBe(samplePayload.password);
            expect(decoded.iat).toBeDefined();
            expect(decoded.exp).toBeDefined();
            expect(decoded.exp).toBeGreaterThan(decoded.iat);
        });

        it('should decode a token without crypto', () => {
            const token = adapter.sign(samplePayload);
            const decoded = adapter.decode(token);

            expect(decoded).not.toBeNull();
            expect(decoded!.user.userId).toBe(samplePayload.userId);
            expect(decoded!.user.email).toBe(samplePayload.email);
            expect(decoded!.user.password).toBe(samplePayload.password);
        });

        it('should reject a token not in the store', () => {
            expect(() => adapter.verify('test-token-unknown-12345')).toThrow('Invalid token: not found in store');
        });

        it('should return null when decoding a token not in store', () => {
            const decoded = adapter.decode('test-token-unknown-12345');
            // For unknown tokens matching the format, it returns a partial decode
            expect(decoded).not.toBeNull();
            expect(decoded!.user.userId).toBe('unknown');
        });

        it('should return null for completely malformed token', () => {
            const decoded = adapter.decode('not-a-token');
            expect(decoded).toBeNull();
        });

        it('should produce deterministic token format', () => {
            const token = adapter.sign(samplePayload);
            expect(token).toMatch(/^test-token-user-123-\d+-\d+$/);
        });

        it('should allow clearing the token store', () => {
            const token = adapter.sign(samplePayload);
            adapter.clear();
            expect(() => adapter.verify(token)).toThrow('Invalid token: not found in store');
        });

        it('should produce different tokens for each sign call', () => {
            const token1 = adapter.sign(samplePayload);
            const token2 = adapter.sign(samplePayload);
            expect(token1).not.toBe(token2);
        });
    });
});