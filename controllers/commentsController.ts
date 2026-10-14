import Article from '../models/Article';
import User, { IUser } from '../models/User';
import Comment from '../models/Comment';
import asyncHandler from 'express-async-handler';
import { Response } from 'express';
import { AuthenticatedRequest, CommentRequestBody } from '../types/express';
import { NotFoundError, ForbiddenError, UnauthorizedError } from '../src/shared/errors/AppError';

const addCommentsToArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;

    const commenter = await User.findById(userId).exec();

    if (!commenter) {
        throw new UnauthorizedError('User Not Found');
    }

    const { slug } = req.params;

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        throw new NotFoundError('Article Not Found');
    }

    const { body } = req.body.comment;

    const newComment = await Comment.create({
        body,
        author: commenter._id,
        article: article._id
    });

    await article.addComment(newComment._id);

    res.status(201).json({
        comment: await newComment.toCommentResponse(commenter)
    });
});

const getCommentsFromArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { slug } = req.params;

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        throw new NotFoundError('Article Not Found');
    }

    let user: IUser | false = false;
    if (req.loggedin && req.userId) {
        user = (await User.findById(req.userId).exec()) ?? false;
    }

    res.status(200).json({
        comments: await Promise.all(article.comments.map(async (commentId) => {
            const commentObj = await Comment.findById(commentId).exec();
            return await commentObj?.toCommentResponse(user);
        }))
    });
});

const deleteComment = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;

    const commenter = await User.findById(userId).exec();

    if (!commenter) {
        throw new UnauthorizedError('User Not Found');
    }

    const { slug, id } = req.params;

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        throw new NotFoundError('Article Not Found');
    }

    const comment = await Comment.findById(id).exec();

    if (!comment) {
        throw new NotFoundError('Comment Not Found');
    }

    if (comment.author.toString() === commenter._id.toString()) {
        await article.removeComment(comment._id);
        await Comment.deleteOne({ _id: comment._id });
        res.status(200).json({ message: 'Comment successfully deleted' });
    } else {
        throw new ForbiddenError('Only the author can delete their comment');
    }
});

export {
    addCommentsToArticle,
    getCommentsFromArticle,
    deleteComment
};
