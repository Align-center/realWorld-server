import User from '../models/User';
import asyncHandler from 'express-async-handler';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { NotFoundError, UnauthorizedError } from '../src/shared/errors/AppError';

const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { username } = req.params;
    const loggedin = req.loggedin;

    const user = await User.findOne({ username }).exec();

    if (!user) {
        throw new NotFoundError('User Not Found');
    }

    if (!loggedin) {
        res.status(200).json({
            profile: user.toProfileJSON(false)
        });
        return;
    }

    const loginUser = await User.findOne({ email: req.userEmail }).exec();
    if (!loginUser) {
        throw new UnauthorizedError('User Not Found');
    }

    res.status(200).json({
        profile: user.toProfileJSON(loginUser)
    });
});

const followUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { username } = req.params;

    const loginUser = await User.findOne({ email: req.userEmail }).exec();
    const user = await User.findOne({ username }).exec();

    if (!user || !loginUser) {
        throw new NotFoundError('User Not Found');
    }

    await loginUser.follow(user._id);

    res.status(200).json({
        profile: user.toProfileJSON(loginUser)
    });
});

const unFollowUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { username } = req.params;

    const loginUser = await User.findOne({ email: req.userEmail }).exec();
    const user = await User.findOne({ username }).exec();

    if (!user || !loginUser) {
        throw new NotFoundError('User Not Found');
    }

    await loginUser.unfollow(user._id);

    res.status(200).json({
        profile: user.toProfileJSON(loginUser)
    });
});

export {
    getProfile,
    followUser,
    unFollowUser
};
