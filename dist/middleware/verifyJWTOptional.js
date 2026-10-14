"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const verifyJWTOptional = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Token ') || !authHeader.split(' ')[1]?.length) {
        req.loggedin = false;
        next();
        return;
    }
    const token = authHeader.split(' ')[1];
    jsonwebtoken_1.default.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }
        req.loggedin = true;
        req.userId = decoded.user.id;
        req.userEmail = decoded.user.email;
        req.userHashedPwd = decoded.user.password;
        next();
    });
};
exports.default = verifyJWTOptional;
//# sourceMappingURL=verifyJWTOptional.js.map