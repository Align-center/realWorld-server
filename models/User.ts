import mongoose from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import jwt from 'jsonwebtoken';

// Define interfaces for the User document
export interface IUser extends mongoose.Document {
    username: string;
    password: string;
    email: string;
    bio: string;
    image: string;
    favouriteArticles: mongoose.Types.ObjectId[];
    followingUsers: mongoose.Types.ObjectId[];
    generateAccessToken(): string;
    toUserResponse(): {
        username: string;
        email: string;
        bio: string;
        image: string;
        token: string;
    };
    toProfileJSON(user: IUser | false): {
        username: string;
        bio: string;
        image: string;
        following: boolean;
    };
    isFollowing(id: mongoose.Types.ObjectId): boolean;
    follow(id: mongoose.Types.ObjectId): Promise<IUser>;
    unfollow(id: mongoose.Types.ObjectId): Promise<IUser>;
    isFavourite(id: mongoose.Types.ObjectId): boolean;
    favorite(id: mongoose.Types.ObjectId): Promise<IUser>;
    unfavorite(id: mongoose.Types.ObjectId): Promise<IUser>;
}

const userSchema = new mongoose.Schema<IUser>({
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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Article'
    }],
    followingUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

userSchema.plugin(uniqueValidator);

// @desc generate access token for a user
// @required valid email and password
userSchema.methods.generateAccessToken = function (): string {
    const accessToken = jwt.sign({
            user: {
                id: this._id,
                email: this.email,
                password: this.password
            }
        },
        process.env.ACCESS_TOKEN_SECRET as string,
        { expiresIn: '1d' }
    );
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

userSchema.methods.toProfileJSON = function (user: IUser | false) {
    return {
        username: this.username,
        bio: this.bio,
        image: this.image,
        following: user ? user.isFollowing(this._id) : false
    };
};

userSchema.methods.isFollowing = function (id: mongoose.Types.ObjectId): boolean {
    const idStr = id.toString();
    for (const followingUser of this.followingUsers) {
        if (followingUser.toString() === idStr) {
            return true;
        }
    }
    return false;
};

userSchema.methods.follow = function (id: mongoose.Types.ObjectId): Promise<IUser> {
    if (this.followingUsers.indexOf(id) === -1) {
        this.followingUsers.push(id);
    }
    return this.save();
};

userSchema.methods.unfollow = function (id: mongoose.Types.ObjectId): Promise<IUser> {
    if (this.followingUsers.indexOf(id) !== -1) {
        this.followingUsers.pull(id);
    }
    return this.save();
};

userSchema.methods.isFavourite = function (id: mongoose.Types.ObjectId): boolean {
    const idStr = id.toString();
    for (const article of this.favouriteArticles) {
        if (article.toString() === idStr) {
            return true;
        }
    }
    return false;
};

userSchema.methods.favorite = function (id: mongoose.Types.ObjectId): Promise<IUser> {
    if (this.favouriteArticles.indexOf(id) === -1) {
        this.favouriteArticles.push(id);
    }
    return this.save();
};

userSchema.methods.unfavorite = function (id: mongoose.Types.ObjectId): Promise<IUser> {
    if (this.favouriteArticles.indexOf(id) !== -1) {
        this.favouriteArticles.pull(id);
    }
    return this.save();
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;