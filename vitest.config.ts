import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['tests/setup.ts'],
        include: ['tests/**/*.test.ts'],
        testTimeout: 10000,
        hookTimeout: 10000,
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
        // Allow tests to run even if MongoDB setup fails (for unit tests that don't need DB)
        passWithNoTests: true,
    },
});
