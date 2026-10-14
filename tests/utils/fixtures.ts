import User from '@/models/User';
import Article from '@/models/Article';
import type { IUser } from '@/models/User';
import type { IArticle } from '@/models/Article';
import mongoose from 'mongoose';

export interface SeedUserOptions {
    username?: string;
    email?: string;
    password?: string;
    bio?: string;
    image?: string;
}

export interface SeedArticleOptions {
    title?: string;
    description?: string;
    body?: string;
    tagList?: string[];
    author?: IUser;
}

export const seedUser = async (options: SeedUserOptions = {}): Promise<IUser> => {
    const user = new User({
        username: options.username || `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        email: options.email || `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`,
        password: options.password || 'password123',
        bio: options.bio || '',
        image: options.image || 'https://static.productionready.io/images/smiley-cyrus.jpg',
    });
    return user.save();
};

export const seedArticle = async (options: SeedArticleOptions = {}): Promise<IArticle> => {
    let author = options.author;
    if (!author) {
        author = await seedUser();
    }

    const article = new Article({
        title: options.title || `Test Article ${Date.now()}`,
        description: options.description || 'Test description',
        body: options.body || 'Test body content',
        tagList: options.tagList || ['test', 'article'],
        author: author._id,
    });
    return article.save();
};

export const authToken = (user: IUser): string => {
    return user.generateAccessToken();
};

export const authHeader = (user: IUser): { Authorization: string } => {
    return { Authorization: `Token ${authToken(user)}` };
};