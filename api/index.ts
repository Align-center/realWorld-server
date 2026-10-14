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
import { AppError, ValidationError } from '../src/shared/errors/AppError';

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

// Global error handler - must be last middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof AppError) {
        if (err instanceof ValidationError && Object.keys(err.errors).length > 0) {
            return res.status(err.statusCode).json({ errors: err.errors });
        }
        return res.status(err.statusCode).json({ message: err.message });
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const mongooseErr = err as any;
        const errors: Record<string, string[]> = {};
        for (const field in mongooseErr.errors) {
            errors[field] = [mongooseErr.errors[field].message];
        }
        return res.status(422).json({ errors });
    }

    // Handle Mongoose duplicate key errors
    if (err.name === 'MongoServerError' && (err as any).code === 11000) {
        const mongoErr = err as any;
        const field = Object.keys(mongoErr.keyValue)[0];
        return res.status(422).json({ errors: { [field]: ['already exists'] } });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
});

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