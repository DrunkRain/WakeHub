import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist', '**/node_modules'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },

  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [
      jsxA11y.flatConfigs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  {
    files: ['apps/server/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
