// ESLint flat config (ESLint v10 dropped legacy .eslintrc support).
// Mirrors the previous .eslintrc.json: Next core-web-vitals + TypeScript,
// with the same rule tuning. eslint-config-next@16 exports ready-made flat
// config arrays, so no @eslint/eslintrc FlatCompat bridge is needed.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default [
  // Global ignores — generated/build output must NOT be linted (Turbopack
  // regenerates .next/dev/types and they aren't valid standalone TS).
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'next-env.d.ts',
      'public/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // Standard pattern: _-prefixed names are intentional "I needed the
      // position but not the value" (destructuring, callback params, …).
      // Without this both eslint reports them as "unused" — false noise.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/self-closing-comp': 'warn',
      'react/jsx-sort-props': 'off',
      'react/no-unescaped-entities': 'off',
      // Opinionated React rules: surface as warnings, not build-blocking errors.
      // set-state-in-effect fires on legitimate init/sync patterns; the
      // comment-textnode cases are code examples shown in the docs pages.
      'react-hooks/set-state-in-effect': 'warn',
      'react/jsx-no-comment-textnodes': 'warn',
    },
  },
  {
    // Test files legitimately use require() for dynamic imports / mocking.
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]
