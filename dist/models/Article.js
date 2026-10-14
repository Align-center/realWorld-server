"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_unique_validator_1 = __importDefault(require("mongoose-unique-validator"));
const slugify_1 = __importDefault(require("slugify"));
const User_1 = __importDefault(require("./User"));
const articleSchema = new mongoose_1.default.Schema({
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
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
    },
    favouritesCount: {
        type: Number,
        default: 0
    },
    comments: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Comment'
        }]
}, {
    timestamps: true
});
articleSchema.plugin(mongoose_unique_validator_1.default);
articleSchema.pre('save', function (next) {
    this.slug = (0, slugify_1.default)(this.title, { lower: true, replacement: '-' });
    next();
});
articleSchema.methods.updateFavoriteCount = async function () {
    const favoriteCount = await User_1.default.countDocuments({
        favouriteArticles: { $in: [this._id] }
    });
    this.favouritesCount = favoriteCount;
    return this.save();
};
// user is the logged-in user
articleSchema.methods.toArticleResponse = async function (user) {
    const authorObj = await User_1.default.findById(this.author).exec();
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
articleSchema.methods.addComment = function (commentId) {
    if (this.comments.indexOf(commentId) === -1) {
        this.comments.push(commentId);
    }
    return this.save();
};
articleSchema.methods.removeComment = function (commentId) {
    if (this.comments.indexOf(commentId) !== -1) {
        this.comments.pull(commentId);
    }
    return this.save();
};
const Article = mongoose_1.default.model('Article', articleSchema);
exports.default = Article;
//# sourceMappingURL=Article.js.map