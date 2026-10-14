"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_unique_validator_1 = __importDefault(require("mongoose-unique-validator"));
const tagSchema = new mongoose_1.default.Schema({
    tagName: {
        type: String,
        required: true,
        unique: true
    },
    articles: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Article'
        }]
});
tagSchema.plugin(mongoose_unique_validator_1.default);
const Tag = mongoose_1.default.model('Tag', tagSchema);
exports.default = Tag;
//# sourceMappingURL=Tag.js.map