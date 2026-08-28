import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const fsdLayerPathGroups = [
  { pattern: '@/app/**', group: 'internal', position: 'before' },
  { pattern: '@/pages/**', group: 'internal', position: 'before' },
  { pattern: '@/widgets/**', group: 'internal', position: 'before' },
  { pattern: '@/features/**', group: 'internal', position: 'before' },
  { pattern: '@/entities/**', group: 'internal', position: 'before' },
  { pattern: '@/shared/**', group: 'internal', position: 'after' },
];

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'array',
          readonly: 'array',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            'React.FC': {
              message: 'Не используйте React.FC — типизируйте props напрямую в аргументах функции.',
            },
            FC: {
              message: 'Не используйте FC — типизируйте props напрямую в аргументах функции.',
            },
            'React.FunctionComponent': {
              message:
                'Не используйте React.FunctionComponent — типизируйте props напрямую в аргументах функции.',
            },
            FunctionComponent: {
              message:
                'Не используйте FunctionComponent — типизируйте props напрямую в аргументах функции.',
            },
          },
        },
      ],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          pathGroups: [
            {
              pattern: 'react',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'react-dom',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'react-router-dom',
              group: 'external',
              position: 'before',
            },
            ...fsdLayerPathGroups,
          ],
          pathGroupsExcludedImportTypes: ['type'],
        },
      ],
      'import/no-duplicates': 'error',
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.app.json',
        },
      },
    },
  },
  {
    files: ['*.{js,ts}', '*.config.{js,ts}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/order': 'off',
    },
  },
  eslintConfigPrettier
);
