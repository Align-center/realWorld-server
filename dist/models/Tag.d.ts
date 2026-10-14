import mongoose from 'mongoose';
export interface ITag extends mongoose.Document {
    tagName: string;
    articles: mongoose.Types.ObjectId[];
}
declare const Tag: mongoose.Model<ITag, {}, {}, {}, any>;
export default Tag;
//# sourceMappingURL=Tag.d.ts.map