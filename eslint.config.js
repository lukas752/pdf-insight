import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'dist',
      'node_modules',
      'worker/node_modules',
      'worker/dist',
      '.wrangler',
      'worker/.wrangler',
    ],
  },
  js.configs.recommended,
  // Type-aware linting: rules such as no-floating-promises and no-unsafe-* need type information.
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `unknown` + Zod narrowing at every boundary; `any` is never acceptable.
      '@typescript-eslint/no-explicit-any': 'error',
      // Operational logging in the Worker goes through its `log()` helper only.
      'no-console': 'error',
      // Numbers in template strings (page counts, byte sizes) are intentional and readable.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['worker/src/**/*.ts'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Plain JS config files are not part of a TypeScript project.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
