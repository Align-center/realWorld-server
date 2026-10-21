import Article from '@/models/Article';

export const TagModule = {
    /**
     * Get all distinct tags from articles
     * @returns Promise<string[]> - Array of distinct tag strings, sorted alphabetically
     */
    async getAllTags(): Promise<string[]> {
        const tags = await Article.find().distinct('tagList').exec();
        return tags.sort();
    }
};

export default TagModule;