"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_unique_validator_1 = __importDefault(require("mongoose-unique-validator"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userSchema = new mongoose_1.default.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true,
        match: [/\S+@\S+\.\S+/, 'is invalid'],
        index: true
    },
    bio: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        default: 'https://static.productionready.io/images/smiley-cyrus.jpg'
    },
    favouriteArticles: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Article'
        }],
    followingUsers: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User'
        }]
}, {
    timestamps: true
});
userSchema.plugin(mongoose_unique_validator_1.default);
// @desc generate access token for a user
// @required valid email and password
userSchema.methods.generateAccessToken = function () {
    const accessToken = jsonwebtoken_1.default.sign({
        user: {
            id: this._id,
            email: this.email,
            password: this.password
        }
    }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
    return accessToken;
};
userSchema.methods.toUserResponse = function () {
    return {
        username: this.username,
        email: this.email,
        bio: this.bio,
        image: this.image,
        token: this.generateAccessToken()
    };
};
userSchema.methods.toProfileJSON = function (user) {
    return {
        username: this.username,
        bio: this.bio,
        image: this.image,
        following: user ? user.isFollowing(this._id) : false
    };
};
userSchema.methods.isFollowing = function (id) {
    const idStr = id.toString();
    for (const followingUser of this.followingUsers) {
        if (followingUser.toString() === idStr) {
            return true;
        }
    }
    return false;
};
userSchema.methods.follow = function (id) {
    if (this.followingUsers.indexOf(id) === -1) {
        this.followingUsers.push(id);
    }
    return this.save();
};
userSchema.methods.unfollow = function (id) {
    if (this.followingUsers.indexOf(id) !== -1) {
        this.followingUsers.pull(id);
    }
    return this.save();
};
userSchema.methods.isFavourite = function (id) {
    const idStr = id.toString();
    for (const article of this.favouriteArticles) {
        if (article.toString() === idStr) {
            return true;
        }
    }
    return false;
};
userSchema.methods.favorite = function (id) {
    if (this.favouriteArticles.indexOf(id) === -1) {
        this.favouriteArticles.push(id);
    }
    return this.save();
};
userSchema.methods.unfavorite = function (id) {
    if (this.favouriteArticles.indexOf(id) !== -1) {
        this.favouriteArticles.pull(id);
    }
    return this.save();
};
const User = mongoose_1.default.model('User', userSchema);
exports.default = User;
//# sourceMappingURL=User.js.map