"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unFollowUser = exports.followUser = exports.getProfile = void 0;
const User_1 = __importDefault(require("../models/User"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const getProfile = (0, express_async_handler_1.default)(async (req, res) => {
    const { username } = req.params;
    const loggedin = req.loggedin;
    const user = await User_1.default.findOne({ username }).exec();
    if (!user) {
        res.status(404).json({ message: 'User Not Found' });
        return;
    }
    if (!loggedin) {
        res.status(200).json({
            profile: user.toProfileJSON(false)
        });
        return;
    }
    const loginUser = await User_1.default.findOne({ email: req.userEmail }).exec();
    if (!loginUser) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }
    res.status(200).json({
        profile: user.toProfileJSON(loginUser)
    });
});
exports.getProfile = getProfile;
const followUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { username } = req.params;
    const loginUser = await User_1.default.findOne({ email: req.userEmail }).exec();
    const user = await User_1.default.findOne({ username }).exec();
    if (!user || !loginUser) {
        res.status(404).json({ message: 'User Not Found' });
        return;
    }
    await loginUser.follow(user._id);
    res.status(200).json({
        profile: user.toProfileJSON(loginUser)
    });
});
exports.followUser = followUser;
const unFollowUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { username } = req.params;
    const loginUser = await User_1.default.findOne({ email: req.userEmail }).exec();
    const user = await User_1.default.findOne({ username }).exec();
    if (!user || !loginUser) {
        res.status(404).json({ message: 'User Not Found' });
        return;
    }
    await loginUser.unfollow(user._id);
    res.status(200).json({
        profile: user.toProfileJSON(loginUser)
    });
});
exports.unFollowUser = unFollowUser;
//# sourceMappingURL=profilesController.js.map