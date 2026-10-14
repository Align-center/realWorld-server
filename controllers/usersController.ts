import User, { IUser } from '../models/User';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';

interface UserRequestBody {
    user: {
        email: string;
        username: string;
        password: string;
        image?: string;
        bio?: string;
    };
}

interface AuthenticatedRequest extends Request {
    userId?: string;
    userEmail?: string;
    userHashedPwd?: string;
}

// @desc registration for a user
// @route POST /api/users
// @access Public
// @required fields {email, username, password}
// @return User
const registerUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { user } = req.body as UserRequestBody;

    // confirm data
    if (!user || !user.email || !user.username || !user.password) {
        res.status(400).json({ message: 'All fields are required' });
        return;
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
        res.status(422).json({
            errors: {
                body: 'Unable to register a user'
            }
        });
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
        res.status(404).json({ message: 'User Not Found' });
        return;
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
    if (!user || !user.email || !user.password) {
        res.status(400).json({ message: 'All fields are required' });
        return;
    }

    const loginUser = await User.findOne({ email: user.email }).exec();

    if (!loginUser) {
        res.status(404).json({ message: 'User Not Found' });
        return;
    }

    const match = await bcrypt.compare(user.password, loginUser.password);

    if (!match) {
        res.status(401).json({ message: 'Unauthorized: Wrong password' });
        return;
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
        res.status(400).json({ message: 'Required a User object' });
        return;
    }

    const email = req.userEmail;

    const target = await User.findOne({ email }).exec();

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