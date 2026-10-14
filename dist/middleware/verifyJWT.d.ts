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
declare const verifyJWT: (req: Request, res: Response, next: NextFunction) => void;
export default verifyJWT;
//# sourceMappingURL=verifyJWT.d.ts.map