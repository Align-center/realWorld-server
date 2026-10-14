"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(process.env.DATABASE_URI);
    }
    catch (err) {
        console.log(err);
    }
};
exports.default = connectDB;
//# sourceMappingURL=dbConnect.js.map