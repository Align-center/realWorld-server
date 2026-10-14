"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const corsOptions_1 = __importDefault(require("../config/corsOptions"));
const dbConnect_1 = __importDefault(require("../config/dbConnect"));
const mongoose_1 = __importDefault(require("mongoose"));
const root_1 = __importDefault(require("../routes/root"));
const testRoutes_1 = __importDefault(require("../routes/testRoutes"));
const userRoutes_1 = __importDefault(require("../routes/userRoutes"));
const profileRoutes_1 = __importDefault(require("../routes/profileRoutes"));
const articleRoutes_1 = __importDefault(require("../routes/articleRoutes"));
const tagRoutes_1 = __importDefault(require("../routes/tagRoutes"));
const commentRoutes_1 = __importDefault(require("../routes/commentRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
console.log(process.env.NODE_ENV);
(0, dbConnect_1.default)();
app.use((0, cors_1.default)(corsOptions_1.default));
app.use(express_1.default.json()); // middleware to parse json
app.use((0, cookie_parser_1.default)());
// static route
app.use('/', express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use('/', root_1.default);
// user routes - for testing
app.use('/test', testRoutes_1.default);
// user routes - for /api/users and /api/user
app.use('/api', userRoutes_1.default);
// user routes - for profiles
app.use('/api/profiles', profileRoutes_1.default);
// article routes
app.use('/api/articles', articleRoutes_1.default);
// tag route
app.use('/api/tags', tagRoutes_1.default);
// comment routes
app.use('/api/articles', commentRoutes_1.default);
mongoose_1.default.connection.once('open', () => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
mongoose_1.default.connection.on('error', (err) => {
    console.log(err);
});
exports.default = app;
//# sourceMappingURL=index.js.map