import User from '../models/User';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcrypt';
import { Response } from 'express';
import { AuthenticatedRequest, UserRequestBody } from '../types/express';
import { NotFoundError, UnauthorizedError, ValidationError, ConflictError } from '../src/shared/errors/AppError';

// @desc registration for a user
// @route POST /api/users
// @access Public
// @required fields {email, username, password}
// @return User
const registerUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { user } = req.body as UserRequestBody;

    // confirm data
    const missingFields: string[] = [];
    if (!user) {
        missingFields.push('user');
    } else {
        if (!user.email) missingFields.push('email');
        if (!user.username) missingFields.push('username');
        if (!user.password) missingFields.push('password');
    }

    if (missingFields.length > 0) {
        const fieldErrors: Record<string, string[]> = {};
        for (const field of missingFields) {
            fieldErrors[field] = [`${field} is required`];
        }
        throw new ValidationError('Validation failed', fieldErrors);
    }

    // hash password
    const hashedPwd = await bcrypt.hash(user.password, 10); // salt rounds

    const userObject = {
        username: user.username,
        password: hashedPwd,
        email: user.email
    };

    const createdUser = await User.create(userObject);

    if (createdUser) { // user object created successfully
        res.status(201).json({
            user: createdUser.toUserResponse()
        });
    } else {
        throw new ConflictError('Unable to register a user');
    }
});

// @desc get currently logged-in user
// @route GET /api/user
// @access Private
// @return User
const getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // After authentication; email and hashed password was stored in req
    const email = req.userEmail;

    const user = await User.findOne({ email }).exec();

    if (!user) {
        throw new NotFoundError('User Not Found');
    }

    res.status(200).json({
        user: user.toUserResponse()
    });
});

// @desc login for a user
// @route POST /api/users/login
// @access Public
// @required fields {email, password}
// @return User
const userLogin = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { user } = req.body as UserRequestBody;

    // confirm data
    const missingFields: string[] = [];
    if (!user) {
        missingFields.push('user');
    } else {
        if (!user.email) missingFields.push('email');
        if (!user.password) missingFields.push('password');
    }

    if (missingFields.length > 0) {
        const fieldErrors: Record<string, string[]> = {};
        for (const field of missingFields) {
            fieldErrors[field] = [`${field} is required`];
        }
        throw new ValidationError('Validation failed', fieldErrors);
    }

    const loginUser = await User.findOne({ email: user.email }).exec();

    if (!loginUser) {
        throw new NotFoundError('User Not Found');
    }

    const match = await bcrypt.compare(user.password, loginUser.password);

    if (!match) {
        throw new UnauthorizedError('Wrong password');
    }

    res.status(200).json({
        user: loginUser.toUserResponse()
    });
});

// @desc update currently logged-in user
// Warning: if password or email is updated, client-side must update the token
// @route PUT /api/user
// @access Private
// @return User
const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { user } = req.body as UserRequestBody;

    // confirm data
    if (!user) {
        throw new ValidationError('User object is required', { user: ['User object is required'] });
    }

    const email = req.userEmail;

    const target = await User.findOne({ email }).exec();

    if (!target) {
        throw new NotFoundError('User Not Found');
    }

    if (user.email) {
        target.email = user.email;
    }
    if (user.username) {
        target.username = user.username;
    }
    if (user.password) {
        const hashedPwd = await bcrypt.hash(user.password, 10);
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

export {
    registerUser,
    getCurrentUser,
    userLogin,
    updateUser
};
