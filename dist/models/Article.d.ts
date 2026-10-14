import mongoose from 'mongoose';
import { IUser } from './User';
export interface IArticle extends mongoose.Document {
    slug: string;
    title: string;
    description: string;
    body: string;
    tagList: string[];
    author: mongoose.Types.ObjectId;
    favouritesCount: number;
    comments: mongoose.Types.ObjectId[];
    updateFavoriteCount(): Promise<IArticle>;
    toArticleResponse(user: IUser | false): Promise<{
        slug: string;
        title: string;
        description: string;
        body: string;
        createdAt: Date;
        updatedAt: Date;
        tagList: string[];
        favorited: boolean;
        favoritesCount: number;
        author: {
            username: string;
            bio: string;
            image: string;
            following: boolean;
        };
    }>;
    addComment(commentId: mongoose.Types.ObjectId): Promise<IArticle>;
    removeComment(commentId: mongoose.Types.ObjectId): Promise<IArticle>;
}
declare const Article: mongoose.Model<IArticle, {}, {}, {}, any>;
export default Article;
//# sourceMappingURL=Article.d.ts.map