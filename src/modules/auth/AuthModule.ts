import bcrypt from 'bcrypt';
import type { Document } from 'mongoose';
import type UserModel from '@/models/User';
import type { IUser } from '@/models/User';
import type { TokenPort, TokenPayload } from './ports/TokenPort';
import { ValidationError, NotFoundError, UnauthorizedError, ConflictError } from '@/src/shared/errors/AppError';

/** Default profile image URL (matches User model default) */
const DEFAULT_IMAGE_URL = 'https://static.productionready.io/images/smiley-cyrus.jpg';

/** Type for a fully populated User document */
type UserDoc = IUser & Document;

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
            throw new NotFoundError('User not found');
        }

        const isMatch = await bcrypt.compare(input.password, user.password);

        if (!isMatch) {
            throw new UnauthorizedError('Invalid password');
        }

        const token = this.generateToken(user);

        return this.toUserDTO(user, token);
    }

    /**
     * Gets the current user by ID.
     * Returns UserDTO with a newly generated token.
     * @param userId - User ID
     * @returns UserDTO
     * @throws NotFoundError if user not found
     */
    async getCurrentUser(userId: string): Promise<UserDTO> {
        const user = await this.userModel.findById(userId).exec();

        if (!user) {
            throw new NotFoundError('User not found');
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
            throw new NotFoundError('User not found');
        }

        await this.checkAndApplyUniqueFieldChange(user, 'email', patch.email, 'Email already exists');
        await this.checkAndApplyUniqueFieldChange(user, 'username', patch.username, 'Username already exists');
        await this.applyPasswordChange(user, patch.password);
        this.applyOptionalFields(user, patch);

        await user.save();

        const token = this.generateToken(user);

        return this.toUserDTO(user, token);
    }

    /**
     * Checks for a unique field conflict and applies the change if valid.
     */
    private async checkAndApplyUniqueFieldChange<
        T extends UserDoc,
        K extends keyof Pick<T, 'email' | 'username'>
    >(
        user: T,
        field: K,
        newValue: string | undefined,
        errorMessage: string
    ): Promise<void> {
        if (newValue && newValue !== user[field]) {
            const existing = await this.userModel.findOne({ [field]: newValue }).exec();
            if (existing) {
                throw new ConflictError(errorMessage);
            }
            user[field] = newValue;
        }
    }

    /**
     * Applies password change with hashing if provided.
     */
    private async applyPasswordChange(user: UserDoc, newPassword?: string): Promise<void> {
        if (newPassword) {
            user.password = await bcrypt.hash(newPassword, this.saltRounds);
        }
    }

    /**
     * Applies optional field updates (bio, image).
     */
    private applyOptionalFields(user: UserDoc, patch: UpdateUserInput): void {
        if (patch.bio !== undefined) {
            user.bio = patch.bio;
        }
        if (patch.image !== undefined) {
            user.image = patch.image;
        }
    }

    /**
     * Validates that required fields are present in the input.
     * @throws ValidationError if any required field is missing
     */
    private validateRequiredFields(
        input: object,
        requiredFields: string[],
        context: string
    ): void {
        const missingFields = requiredFields.filter(field => !(field in input) || !input[field as keyof object]);

        if (missingFields.length > 0) {
            const fieldErrors: Record<string, string[]> = {};
            for (const field of missingFields) {
                fieldErrors[field] = [`${field} is required`];
            }
            throw new ValidationError(`Validation failed: ${context}`, fieldErrors);
        }
    }

    /**
     * Validates registration input.
     * @throws ValidationError if any required field is missing
     */
    private validateRegisterInput(input: RegisterInput): void {
        this.validateRequiredFields(input, ['email', 'username', 'password'], 'registration');
    }

    /**
     * Validates login input.
     * @throws ValidationError if any required field is missing
     */
    private validateLoginInput(input: LoginInput): void {
        this.validateRequiredFields(input, ['email', 'password'], 'login');
    }

    /**
     * Generates a token for the user using the injected TokenPort.
     */
    private generateToken(user: UserDoc): string {
        const payload: TokenPayload = {
            userId: user._id.toString(),
            email: user.email,
        };
        return this.tokenPort.sign(payload);
    }

    /**
     * Converts a User document to UserDTO.
     */
    private toUserDTO(user: UserDoc, token: string): UserDTO {
        return {
            username: user.username,
            email: user.email,
            bio: user.bio || '',
            image: user.image || DEFAULT_IMAGE_URL,
            token,
        };
    }
}

export default AuthModule;
