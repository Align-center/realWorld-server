declare module 'mongoose-unique-validator' {
    import { Schema } from 'mongoose';

    function uniqueValidator(schema: Schema, options?: { message?: string }): void;

    export default uniqueValidator;
}