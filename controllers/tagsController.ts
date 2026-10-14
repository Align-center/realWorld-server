import Article from '../models/Article';
import asyncHandler from 'express-async-handler';
import { Request, Response } from 'express';

const getTags = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // distinct "tagList" will return either an error or a list of distinct tags
    const tags = await Article.find().distinct('tagList').exec();
    res.status(200).json({
        tags
    });
});

export {
    getTags
};