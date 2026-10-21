import { TagModule } from '@/modules/TagModule';
import asyncHandler from 'express-async-handler';
import { Request, Response } from 'express';

const getTags = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tags = await TagModule.getAllTags();
    res.status(200).json({
        tags
    });
});

export {
    getTags
};