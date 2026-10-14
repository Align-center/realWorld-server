import Article, { IArticle } from '../models/Article';
import User, { IUser } from '../models/User';
import Comment, { IComment } from '../models/Comment';
import asyncHandler from 'express-async-handler';
import { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
    userId?: string;
    userEmail?: string;
    userHashedPwd?: string;
    loggedin?: boolean;
}

interface CommentRequestBody {
    comment: {
        body: string;
    };
}

const addCommentsToArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.userId;

    const commenter = await User.findById(id).exec();

    if (!commenter) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }

    const { slug } = req.params;

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        res.status(401).json({ message: 'Article Not Found' });
        return;
    }

    const { body } = req.body.comment;

    const newComment = await Comment.create({
        body,
        author: commenter._id,
        article: article._id
    });

    await article.addComment(newComment._id);

    res.status(200).json({
        comment: await newComment.toCommentResponse(commenter)
    });
});

const getCommentsFromArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { slug } = req.params;

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        res.status(401).json({ message: 'Article Not Found' });
        return;
    }

    const loggedin = req.loggedin;

    if (loggedin) {
        const loginUser = await User.findById(req.userId).exec();
        if (!loginUser) {
            res.status(401).json({ message: 'User Not Found' });
            return;
        }
        res.status(200).json({
            comments: await Promise.all(article.comments.map(async (commentId) => {
                const commentObj = await Comment.findById(commentId).exec();
                return await commentObj?.toCommentResponse(loginUser);
            }))
        });
    } else {
        res.status(200).json({
            comments: await Promise.all(article.comments.map(async (commentId) => {
                const commentObj = await Comment.findById(commentId).exec();
                return await commentObj?.toCommentResponse(false);
            }))
        });
    }
});

const deleteComment = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId;

    const commenter = await User.findById(userId).exec();

    if (!commenter) {
        res.status(401).json({ message: 'User Not Found' });
        return;
    }

    const { slug, id } = req.params;

    const article = await Article.findOne({ slug }).exec();

    if (!article) {
        res.status(401).json({ message: 'Article Not Found' });
        return;
    }

    const comment = await Comment.findById(id).exec();

    if (!comment) {
        res.status(404).json({ message: 'Comment Not Found' });
        return;
    }

    if (comment.author.toString() === commenter._id.toString()) {
        await article.removeComment(comment._id);
        await Comment.deleteOne({ _id: comment._id });
        res.status(200).json({ message: 'comment has been successfully deleted!!!' });
    } else {
        res.status(403).json({ error: 'only the author of the comment can delete the comment' });
    }
});

export {
    addCommentsToArticle,
    getCommentsFromArticle,
    deleteComment
};