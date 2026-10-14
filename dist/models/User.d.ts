import mongoose from 'mongoose';
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
declare const User: mongoose.Model<IUser, {}, {}, {}, any>;
export default User;
//# sourceMappingURL=User.d.ts.map