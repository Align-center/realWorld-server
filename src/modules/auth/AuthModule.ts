import bcrypt from 'bcrypt';
import type { Document } from 'mongoose';
import type UserModel from '@/models/User';
import type { IUser } from '@/models/User';
import type { TokenPort, TokenPayload } from './ports/TokenPort';
import { ValidationError, NotFoundError, UnauthorizedError, ConflictError } from '@/src/shared/errors/AppError';

/**
 * Data Transfer Object for authenticated user responses.
 * Contains username, email, bio, image, and JWT token.
 */
export interface UserDTO {
    username: string;
    email: string;
    bio: string;
    image: string;
    token: string;
}

/**
 * Input for user registration.
 */
export interface RegisterInput {
    email: string;
    username: string;
    password: string;
}

/**
 * Input for user login.
 */
export interface LoginInput {
    email: string;
    password: string;
}

/**
 * Input for user update (all fields optional).
 */
export interface UpdateUserInput {
    email?: string;
    username?: string;
    password?: string;
    bio?: string;
    image?: string;
}

/**
 * AuthModule encapsulates authentication logic including:
 * - User registration with password hashing
 * - User login with bcrypt verification
 * - Current user retrieval
 * - User profile updates
 *
 * Password hashing is fully encapsulated - controllers never touch bcrypt directly.
 * Token generation is delegated to an injected TokenPort for testability.
 */
export class AuthModule {
    private readonly userModel: typeof UserModel;
    private readonly tokenPort: TokenPort;
    private readonly saltRounds = 10;

    /**
     * Creates an AuthModule instance.
     * @param userModel - Mongoose User model for persistence
     * @param tokenPort - TokenPort implementation for token generation/verification
     */
    constructor(userModel: typeof UserModel, tokenPort: TokenPort) {
        this.userModel = userModel;
        this.tokenPort = tokenPort;
    }

    /**
     * Registers a new user.
     * Hashes password, creates user document, returns UserDTO with token.
     * @param input - Registration data (email, username, password)
     * @returns UserDTO with generated token
     * @throws ValidationError if required fields are missing
     * @throws ConflictError if email or username already exists
     */
    async register(input: RegisterInput): Promise<UserDTO> {
        this.validateRegisterInput(input);

        // Check for existing email or username
        const existingUser = await this.userModel.findOne({
            $or: [{ email: input.email }, { username: input.username }],
        }).exec();

        if (existingUser) {
            if (existingUser.email === input.email) {
                throw new ConflictError('Email already exists');
            }
            throw new ConflictError('Username already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(input.password, this.saltRounds);

        // Create user
        const user = await this.userModel.create({
            email: input.email,
            username: input.username,
            password: hashedPassword,
        });

        // Generate token
        const token = this.generateToken(user);

        return this.toUserDTO(user, token);
    }

    /**
     * Logs in a user.
     * Verifies bcrypt password, returns UserDTO with token.
     * @param input - Login credentials (email, password)
     * @returns UserDTO with generated token
     * @throws ValidationError if required fields are missing
     * @throws NotFoundError if user not found
     * @throws UnauthorizedError if password is incorrect
     */
    async login(input: LoginInput): Promise<UserDTO> {
        this.validateLoginInput(input);

        const user = await this.userModel.findOne({ email: input.email }).exec();

        if (!user) {
            throw new NotFoundError('User Not Found');
        }

        const isMatch = await bcrypt.compare(input.password, user.password);

        if (!isMatch) {
            throw new UnauthorizedError('Wrong password');
        }

        const token = this.generateToken(user);

        return this.toUserDTO(user, token);
    }

    /**
     * Gets the current user by ID.
     * Returns UserDTO without regenerating token (uses existing token from DB or generates new one).
     * @param userId - User ID
     * @returns UserDTO
     * @throws NotFoundError if user not found
     */
    async getCurrentUser(userId: string): Promise<UserDTO> {
        const user = await this.userModel.findById(userId).exec();

        if (!user) {
            throw new NotFoundError('User Not Found');
        }

        const token = this.generateToken(user);

        return this.toUserDTO(user, token);
    }

    /**
     * Updates a user's profile.
     * Handles partial updates for email, username, password, bio, image.
     * Password is hashed if provided.
     * @param userId - User ID
     * @param patch - Fields to update
     * @returns Updated UserDTO
     * @throws NotFoundError if user not found
     * @throws ConflictError if email or username already taken
     */
    async updateUser(userId: string, patch: UpdateUserInput): Promise<UserDTO> {
        const user = await this.userModel.findById(userId).exec();

        if (!user) {
            throw new NotFoundError('User Not Found');
        }

        await this.checkAndApplyEmailChange(user, patch.email);
        await this.checkAndApplyUsernameChange(user, patch.username);
        this.applyPasswordChange(user, patch.password);
        this.applyOptionalFields(user, patch);

        await user.save();

        const token = this.generateToken(user);

        return this.toUserDTO(user, token);
    }

    /**
     * Checks for email conflicts and applies the change if valid.
     */
    private async checkAndApplyEmailChange(user: IUser & Document, newEmail?: string): Promise<void> {
        if (newEmail && newEmail !== user.email) {
            const existing = await this.userModel.findOne({ email: newEmail }).exec();
            if (existing) {
                throw new ConflictError('Email already exists');
            }
            user.email = newEmail;
        }
    }

    /**
     * Checks for username conflicts and applies the change if valid.
     */
    private async checkAndApplyUsernameChange(user: IUser & Document, newUsername?: string): Promise<void> {
        if (newUsername && newUsername !== user.username) {
            const existing = await this.userModel.findOne({ username: newUsername }).exec();
            if (existing) {
                throw new ConflictError('Username already exists');
            }
            user.username = newUsername;
        }
    }

    /**
     * Applies password change with hashing if provided.
     */
    private applyPasswordChange(user: IUser & Document, newPassword?: string): void {
        if (newPassword) {
            user.password = bcrypt.hashSync(newPassword, this.saltRounds);
        }
    }

    /**
     * Applies optional field updates (bio, image).
     */
    private applyOptionalFields(user: IUser & Document, patch: UpdateUserInput): void {
        if (patch.bio !== undefined) {
            user.bio = patch.bio;
        }
        if (patch.image !== undefined) {
            user.image = patch.image;
        }
    }

    /**
     * Validates registration input.
     * @throws ValidationError if any required field is missing
     */
    private validateRegisterInput(input: RegisterInput): void {
        const missingFields: string[] = [];

        if (!input.email) missingFields.push('email');
        if (!input.username) missingFields.push('username');
        if (!input.password) missingFields.push('password');

        if (missingFields.length > 0) {
            const fieldErrors: Record<string, string[]> = {};
            for (const field of missingFields) {
                fieldErrors[field] = [`${field} is required`];
            }
            throw new ValidationError('Validation failed', fieldErrors);
        }
    }

    /**
     * Validates login input.
     * @throws ValidationError if any required field is missing
     */
    private validateLoginInput(input: LoginInput): void {
        const missingFields: string[] = [];

        if (!input.email) missingFields.push('email');
        if (!input.password) missingFields.push('password');

        if (missingFields.length > 0) {
            const fieldErrors: Record<string, string[]> = {};
            for (const field of missingFields) {
                fieldErrors[field] = [`${field} is required`];
            }
            throw new ValidationError('Validation failed', fieldErrors);
        }
    }

    /**
     * Generates a token for the user using the injected TokenPort.
     */
    private generateToken(user: IUser & Document): string {
        const payload: TokenPayload = {
            userId: user._id.toString(),
            email: user.email,
        };
        return this.tokenPort.sign(payload);
    }

    /**
     * Converts a User document to UserDTO.
     */
    private toUserDTO(user: IUser & Document, token: string): UserDTO {
        return {
            username: user.username,
            email: user.email,
            bio: user.bio || '',
            image: user.image || 'https://static.productionready.io/images/smiley-cyrus.jpg',
            token,
        };
    }
}

export default AuthModule;