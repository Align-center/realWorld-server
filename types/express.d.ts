import { Request } from 'express';
import { IUser } from '../models/User';

declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userEmail?: string;
            userHashedPwd?: string;
            loggedin?: boolean;
        }
    }
}

export interface ArticleRequestBody {
    article: {
        title: string;
        description: string;
        body: string;
        tagList?: string[];
    };
}

export interface CommentRequestBody {
    comment: {
        body: string;
    };
}

export interface UserRequestBody {
    user: {
        email: string;
        username: string;
        password: string;
        image?: string;
        bio?: string;
    };
}

export interface AuthenticatedRequest extends Request {
    userId?: string;
    userEmail?: string;
    userHashedPwd?: string;
    loggedin?: boolean;
}

export interface ArticleQueryParams {
    limit?: string;
    offset?: string;
    tag?: string;
    author?: string;
    favorited?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    itemsCount: number;
}

export interface ArticleResponse {
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
}

export interface CommentResponse {
    id: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
    author: {
        username: string;
        bio: string;
        image: string;
        following: boolean;
    };
}

export interface UserResponse {
    username: string;
    email: string;
    bio: string;
    image: string;
    token: string;
}

export interface ProfileResponse {
    username: string;
    bio: string;
    image: string;
    following: boolean;
}