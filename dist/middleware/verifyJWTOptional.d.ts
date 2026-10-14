import { Request, Response, NextFunction } from 'express';
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
declare const verifyJWTOptional: (req: Request, res: Response, next: NextFunction) => void;
export default verifyJWTOptional;
//# sourceMappingURL=verifyJWTOptional.d.ts.map