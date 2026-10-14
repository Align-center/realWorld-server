import mongoose from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

export interface ITag extends mongoose.Document {
    tagName: string;
    articles: mongoose.Types.ObjectId[];
}

const tagSchema = new mongoose.Schema<ITag>({
    tagName: {
        type: String,
        required: true,
        unique: true
    },
    articles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Article'
    }]
});

tagSchema.plugin(uniqueValidator);

const Tag = mongoose.model<ITag>('Tag', tagSchema);

export default Tag;