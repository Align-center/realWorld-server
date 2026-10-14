import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userEmail?: string;
            userHashedPwd?: string;
        }
    }
}

const verifyJWT = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (typeof authHeader !== 'string' || !authHeader.startsWith('Token ')) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET as string,
        (err: jwt.VerifyErrors | null, decoded: any) => {
            if (err) {
                res.status(403).json({ message: 'Forbidden' });
                return;
            }
            req.userId = decoded.user.id;
            req.userEmail = decoded.user.email;
            req.userHashedPwd = decoded.user.password;
            next();
        }
    );
};

export default verifyJWT;