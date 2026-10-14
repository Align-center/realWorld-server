import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../src/shared/errors/AppError';

declare global {
    namespace Express {
        interface Request {
            loggedin?: boolean;
            userId?: string;
            userEmail?: string;
            userHashedPwd?: string;
        }
    }
}

const verifyJWTOptional = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (typeof authHeader !== 'string' || !authHeader.startsWith('Token ') || !authHeader.split(' ')[1]?.length) {
        req.loggedin = false;
        next();
        return;
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET as string,
        (err: jwt.VerifyErrors | null, decoded: any) => {
            if (err) {
                next(new ForbiddenError());
                return;
            }
            req.loggedin = true;
            req.userId = decoded.user.id;
            req.userEmail = decoded.user.email;
            req.userHashedPwd = decoded.user.password;
            next();
        }
    );
};

export default verifyJWTOptional;