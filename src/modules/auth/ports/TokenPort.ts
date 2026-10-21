import jwt from 'jsonwebtoken';

/** Token expiration: 1 day in seconds */
const TOKEN_EXPIRY_SECONDS = 86_400;
/** Token expiration string for jsonwebtoken */
const TOKEN_EXPIRY_STRING = '1d';

/**
 * Payload structure for token operations.
 * Excludes sensitive fields like password.
 */
export interface TokenPayload {
    userId: string;
    email: string;
}

/**
 * Decoded token result
 */
export interface DecodedToken {
    user: TokenPayload;
    iat: number;
    exp: number;
}

/**
 * Port interface for token generation and verification.
 * Allows swapping between production (JWT) and test (in-memory) implementations.
 */
export interface TokenPort {
    /**
     * Sign a payload and return a token string
     */
    sign(payload: TokenPayload): string;

    /**
     * Verify a token and return the decoded payload
     * Throws if token is invalid or expired
     */
    verify(token: string): DecodedToken;

    /**
     * Decode a token without verification (for inspection)
     * Returns null if token is malformed
     */
    decode(token: string): DecodedToken | null;
}

/**
 * Production adapter using jsonwebtoken library.
 * Uses ACCESS_TOKEN_SECRET from environment variables.
 */
export class JwtAdapter implements TokenPort {
    private readonly secret: string;
    private readonly options: jwt.SignOptions;

    constructor() {
        const secret = process.env.ACCESS_TOKEN_SECRET;
        if (!secret) {
            throw new Error('ACCESS_TOKEN_SECRET environment variable is required for JwtAdapter');
        }
        this.secret = secret;
        this.options = { expiresIn: TOKEN_EXPIRY_STRING };
    }

    sign(payload: TokenPayload): string {
        return jwt.sign({ user: payload }, this.secret, this.options);
    }

    verify(token: string): DecodedToken {
        try {
            return jwt.verify(token, this.secret) as DecodedToken;
        } catch (error) {
            throw new Error(`Token verification failed: ${(error as Error).message}`);
        }
    }

    decode(token: string): DecodedToken | null {
        try {
            return jwt.decode(token) as DecodedToken | null;
        } catch {
            return null;
        }
    }
}

/**
 * Test adapter using in-memory Map for deterministic tokens.
 * No cryptography involved - tokens are simple prefixed strings.
 * Format: `test-token-${userId}-${timestamp}-${counter}`
 */
export class InMemoryTokenAdapter implements TokenPort {
    private readonly tokenStore = new Map<string, TokenPayload>();
    private counter = 0;

    sign(payload: TokenPayload): string {
        this.counter += 1;
        const token = `test-token-${payload.userId}-${Date.now()}-${this.counter}`;
        this.tokenStore.set(token, payload);
        return token;
    }

    private createDecodedToken(payload: TokenPayload): DecodedToken {
        const now = Math.floor(Date.now() / 1000);
        return {
            user: payload,
            iat: now,
            exp: now + TOKEN_EXPIRY_SECONDS,
        };
    }

    verify(token: string): DecodedToken {
        const payload = this.tokenStore.get(token);
        if (!payload) {
            throw new Error('Invalid token: not found in store');
        }
        return this.createDecodedToken(payload);
    }

    decode(token: string): DecodedToken | null {
        const payload = this.tokenStore.get(token);
        if (!payload) {
            // Try to parse deterministic format for tokens not in store
            const match = token.match(/^test-token-(.+)-\d+$/);
            if (match) {
                const userId = match[1];
                const now = Math.floor(Date.now() / 1000);
                return {
                    user: { userId, email: '' },
                    iat: now,
                    exp: now + TOKEN_EXPIRY_SECONDS,
                };
            }
            return null;
        }
        return this.createDecodedToken(payload);
    }

    /**
     * Clear the token store (useful for test isolation)
     */
    clear(): void {
        this.tokenStore.clear();
    }
}