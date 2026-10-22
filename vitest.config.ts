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
        // Allow tests to run even if MongoDB setup fails (for unit tests that don't need DB)
        passWithNoTests: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
            '@/models': path.resolve(__dirname, './models'),
            '@/shared': path.resolve(__dirname, './src/shared'),
            '@/src': path.resolve(__dirname, './src'),
        },
    },
});
