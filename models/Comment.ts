import mongoose from 'mongoose';
import User, { IUser } from './User';

export interface IComment extends mongoose.Document {
    body: string;
    author: mongoose.Types.ObjectId;
    article: mongoose.Types.ObjectId;
    toCommentResponse(user: IUser | false): Promise<{
        id: mongoose.Types.ObjectId;
        body: string;
        createdAt: Date;
        updatedAt: Date;
        author: {
            username: string;
            bio: string;
            image: string;
            following: boolean;
        };
    }>;
}

const commentSchema = new mongoose.Schema<IComment>({
    body: {
        type: String,
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    article: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Article'
    }
}, {
    timestamps: true
});

commentSchema.methods.toCommentResponse = async function (user: IUser | false) {
    const authorObj = await User.findById(this.author).exec();
    return {
        id: this._id,
        body: this.body,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        author: authorObj?.toProfileJSON(user) ?? {
            username: '',
            bio: '',
            image: '',
            following: false
        }
    };
};

const Comment = mongoose.model<IComment>('Comment', commentSchema);

export default Comment;