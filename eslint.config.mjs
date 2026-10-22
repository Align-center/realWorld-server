import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules', 'dist', 'metrics', 'coverage', '.github/', '.idea/', '.scratch/', '.sandcastle/'],
  },
  {
    files: ['**/*.ts'],
    rules: {
      'complexity': ['warn', { max: 10 }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  }
);