"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("./User"));
const commentSchema = new mongoose_1.default.Schema({
    body: {
        type: String,
        required: true
    },
    author: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
    },
    article: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Article'
    }
}, {
    timestamps: true
});
commentSchema.methods.toCommentResponse = async function (user) {
    const authorObj = await User_1.default.findById(this.author).exec();
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
const Comment = mongoose_1.default.model('Comment', commentSchema);
exports.default = Comment;
//# sourceMappingURL=Comment.js.map