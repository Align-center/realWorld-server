import { Request, Response, NextFunction } from 'express';
import { TokenPort, DecodedToken, JwtAdapter } from '@/src/modules/auth/ports/TokenPort';
import { UnauthorizedError, ForbiddenError } from '@/src/shared/errors/AppError';

declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userEmail?: string;
            userHashedPwd?: string;
            loggedin?: boolean;
        }
    }
}

/**
 * Unified authentication middleware that uses TokenPort for token verification.
 * Provides both required and optional authentication modes.
 */
export class AuthMiddleware {
    private readonly tokenPort: TokenPort;

    constructor(tokenPort: TokenPort) {
        this.tokenPort = tokenPort;
    }

    /**
     * Extract token from Authorization header.
     * Expected format: "Token <token>"
     */
    private extractToken(req: Request): string | null {
        const authHeader = req.headers.authorization || req.headers.Authorization;

        if (typeof authHeader !== 'string' || !authHeader.startsWith('Token ')) {
            return null;
        }

        const token = authHeader.split(' ')[1];
        return token?.length ? token : null;
    }

    /**
     * Verify token using the token port.
     * Throws ForbiddenError on failure.
     */
    private async verifyToken(token: string): Promise<DecodedToken> {
        try {
            return this.tokenPort.verify(token);
        } catch {
            throw new ForbiddenError();
        }
    }

    /**
     * Attach decoded user info to request object.
     * Supports both new TokenPayload (userId) and legacy format (id) for backward compatibility.
     */
    private attachUser(req: Request, decoded: DecodedToken): void {
        const user = decoded.user as { userId?: string; id?: string; email: string; password?: string };
        req.userId = user.userId ?? user.id;
        req.userEmail = user.email;
        // Note: TokenPayload no longer includes password (security improvement)
        // userHashedPwd is kept for backward compatibility but will be undefined for new tokens
        req.userHashedPwd = user.password;
    }

    /**
     * Core authentication logic shared by required and optional modes.
     */
    private async authenticate(req: Request, res: Response, next: NextFunction, requireAuth: boolean): Promise<void> {
        const token = this.extractToken(req);

        if (!token) {
            if (requireAuth) {
                next(new UnauthorizedError());
            } else {
                req.loggedin = false;
                next();
            }
            return;
        }

        try {
            const decoded = await this.verifyToken(token);
            if (!requireAuth) {
                req.loggedin = true;
            }
            this.attachUser(req, decoded);
            next();
        } catch (error) {
            next(error);
        }
    }

    /**
     * Middleware factory for required authentication.
     * - Missing token → 401 Unauthorized
     * - Invalid/expired token → 403 Forbidden
     * - Valid token → attaches userId, userEmail to req and continues
     */
    required = () => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        await this.authenticate(req, res, next, true);
    };

    /**
     * Middleware factory for optional authentication.
     * - Missing token → sets req.loggedin = false and continues
     * - Invalid/expired token → 403 Forbidden
     * - Valid token → sets req.loggedin = true, attaches userId, userEmail and continues
     */
    optional = () => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        await this.authenticate(req, res, next, false);
    };
}

/**
 * Default AuthMiddleware instance using JwtAdapter for production use.
 * Environment variables must be set before this module is imported.
 */
let defaultAuthMiddleware: AuthMiddleware | null = null;

export const getAuthMiddleware = (): AuthMiddleware => {
    if (!defaultAuthMiddleware) {
        defaultAuthMiddleware = new AuthMiddleware(new JwtAdapter());
    }
    return defaultAuthMiddleware;
};

export default getAuthMiddleware;
