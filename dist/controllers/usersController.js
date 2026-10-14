"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUser = exports.userLogin = exports.getCurrentUser = exports.registerUser = void 0;
const User_1 = __importDefault(require("../models/User"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// @desc registration for a user
// @route POST /api/users
// @access Public
// @required fields {email, username, password}
// @return User
const registerUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { user } = req.body;
    // confirm data
    if (!user || !user.email || !user.username || !user.password) {
        res.status(400).json({ message: 'All fields are required' });
        return;
    }
    // hash password
    const hashedPwd = await bcrypt_1.default.hash(user.password, 10); // salt rounds
    const userObject = {
        username: user.username,
        password: hashedPwd,
        email: user.email
    };
    const createdUser = await User_1.default.create(userObject);
    if (createdUser) { // user object created successfully
        res.status(201).json({
            user: createdUser.toUserResponse()
        });
    }
    else {
        res.status(422).json({
            errors: {
                body: 'Unable to register a user'
            }
        });
    }
});
exports.registerUser = registerUser;
// @desc get currently logged-in user
// @route GET /api/user
// @access Private
// @return User
const getCurrentUser = (0, express_async_handler_1.default)(async (req, res) => {
    // After authentication; email and hashed password was stored in req
    const email = req.userEmail;
    const user = await User_1.default.findOne({ email }).exec();
    if (!user) {
        res.status(404).json({ message: 'User Not Found' });
        return;
    }
    res.status(200).json({
        user: user.toUserResponse()
    });
});
exports.getCurrentUser = getCurrentUser;
// @desc login for a user
// @route POST /api/users/login
// @access Public
// @required fields {email, password}
// @return User
const userLogin = (0, express_async_handler_1.default)(async (req, res) => {
    const { user } = req.body;
    // confirm data
    if (!user || !user.email || !user.password) {
        res.status(400).json({ message: 'All fields are required' });
        return;
    }
    const loginUser = await User_1.default.findOne({ email: user.email }).exec();
    if (!loginUser) {
        res.status(404).json({ message: 'User Not Found' });
        return;
    }
    const match = await bcrypt_1.default.compare(user.password, loginUser.password);
    if (!match) {
        res.status(401).json({ message: 'Unauthorized: Wrong password' });
        return;
    }
    res.status(200).json({
        user: loginUser.toUserResponse()
    });
});
exports.userLogin = userLogin;
// @desc update currently logged-in user
// Warning: if password or email is updated, client-side must update the token
// @route PUT /api/user
// @access Private
// @return User
const updateUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { user } = req.body;
    // confirm data
    if (!user) {
        res.status(400).json({ message: 'Required a User object' });
        return;
    }
    const email = req.userEmail;
    const target = await User_1.default.findOne({ email }).exec();
    if (!target) {
        res.status(404).json({ message: 'User Not Found' });
        return;
    }
    if (user.email) {
        target.email = user.email;
    }
    if (user.username) {
        target.username = user.username;
    }
    if (user.password) {
        const hashedPwd = await bcrypt_1.default.hash(user.password, 10);
        target.password = hashedPwd;
    }
    if (typeof user.image !== 'undefined') {
        target.image = user.image;
    }
    if (typeof user.bio !== 'undefined') {
        target.bio = user.bio;
    }
    await target.save();
    res.status(200).json({
        user: target.toUserResponse()
    });
});
exports.updateUser = updateUser;
//# sourceMappingURL=usersController.js.map