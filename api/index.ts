import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import corsOptions from '../config/corsOptions';
import connectDB from '../config/dbConnect';
import mongoose from 'mongoose';
import rootRouter from '../routes/root';
import testRoutes from '../routes/testRoutes';
import userRoutes from '../routes/userRoutes';
import profileRoutes from '../routes/profileRoutes';
import articleRoutes from '../routes/articleRoutes';
import tagRoutes from '../routes/tagRoutes';
import commentRoutes from '../routes/commentRoutes';

const app = express();
const PORT = process.env.PORT || 4000;

console.log(process.env.NODE_ENV);
connectDB();

app.use(cors(corsOptions));
app.use(express.json()); // middleware to parse json
app.use(cookieParser());

// static route
app.use('/', express.static(path.join(__dirname, '../public')));
app.use('/', rootRouter);

// user routes - for testing
app.use('/test', testRoutes);

// user routes - for /api/users and /api/user
app.use('/api', userRoutes);

// user routes - for profiles
app.use('/api/profiles', profileRoutes);

// article routes
app.use('/api/articles', articleRoutes);

// tag route
app.use('/api/tags', tagRoutes);

// comment routes
app.use('/api/articles', commentRoutes);

mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

mongoose.connection.on('error', (err) => {
    console.log(err);
});

export default app;