import mongoose from 'mongoose';
import { IUser } from './User';
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
declare const Comment: mongoose.Model<IComment, {}, {}, {}, any>;
export default Comment;
//# sourceMappingURL=Comment.d.ts.map