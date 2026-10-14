import mongoose from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import slugify from 'slugify';
import User, { IUser } from './User';

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

const articleSchema = new mongoose.Schema<IArticle>({
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    tagList: [{
        type: String
    }],
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    favouritesCount: {
        type: Number,
        default: 0
    },
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }]
}, {
    timestamps: true
});

articleSchema.plugin(uniqueValidator);

articleSchema.pre('save', function (next) {
    this.slug = slugify(this.title, { lower: true, replacement: '-' });
    next();
});

articleSchema.methods.updateFavoriteCount = async function (): Promise<IArticle> {
    const favoriteCount = await User.countDocuments({
        favouriteArticles: { $in: [this._id] }
    });

    this.favouritesCount = favoriteCount;
    return this.save();
};

// user is the logged-in user
articleSchema.methods.toArticleResponse = async function (user: IUser | false) {
    const authorObj = await User.findById(this.author).exec();
    return {
        slug: this.slug,
        title: this.title,
        description: this.description,
        body: this.body,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        tagList: this.tagList,
        favorited: user ? user.isFavourite(this._id) : false,
        favoritesCount: this.favouritesCount,
        author: authorObj?.toProfileJSON(user) ?? {
            username: '',
            bio: '',
            image: '',
            following: false
        }
    };
};

articleSchema.methods.addComment = function (commentId: mongoose.Types.ObjectId): Promise<IArticle> {
    if (this.comments.indexOf(commentId) === -1) {
        this.comments.push(commentId);
    }
    return this.save();
};

articleSchema.methods.removeComment = function (commentId: mongoose.Types.ObjectId): Promise<IArticle> {
    if (this.comments.indexOf(commentId) !== -1) {
        this.comments.pull(commentId);
    }
    return this.save();
};

const Article = mongoose.model<IArticle>('Article', articleSchema);

export default Article;