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

export const createApp = (): express.Express => {
    const app = express();

    app.use(cors(corsOptions));
    app.use(express.json());
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
            if (err instanceof ValidationError) {
                return res.status(err.statusCode).json({ errors: err.errors });
            }
            return res.status(err.statusCode).json({ message: err.message });
        }

        // Handle Mongoose validation errors
        if (err.name === 'ValidationError' && 'errors' in err) {
            const mongooseErr = err as { errors: Record<string, { message: string }> };
            const errors: Record<string, string[]> = {};
            for (const field in mongooseErr.errors) {
                errors[field] = [mongooseErr.errors[field].message];
            }
            return res.status(422).json({ errors });
        }

        // Handle Mongoose duplicate key errors
        if (err.name === 'MongoServerError' && 'code' in err && (err as { code: number }).code === 11000) {
            const mongoErr = err as unknown as { keyValue: Record<string, unknown> };
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

    return app;
};

const app = createApp();
const PORT = process.env.PORT || 4000;

const startServer = async (): Promise<void> => {
    await connectDB();

    // Use a flag to prevent duplicate event handlers if startServer is called multiple times
    if (startServer.hasStarted) {
        return;
    }
    startServer.hasStarted = true;

    mongoose.connection.once('open', () => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    });

    mongoose.connection.on('error', (err) => {
        console.log(err);
    });
};

startServer.hasStarted = false;

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
    startServer();
}

export default app;