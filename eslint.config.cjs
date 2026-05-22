const paceCoreConfig = require('@solvera/pace-core/eslint-config');
const js = require('@eslint/js');

let tseslint = null;
let react = null;
let reactHooks = null;

try { tseslint = require('typescript-eslint'); } catch {}
try { react = require('eslint-plugin-react'); } catch {}
try { reactHooks = require('eslint-plugin-react-hooks'); } catch {}

const config = [
  ...paceCoreConfig,
  js.configs.recommended,
];

if (tseslint?.configs?.recommended) {
  config.push(...tseslint.configs.recommended);
}

if (react?.configs?.recommended?.rules && reactHooks?.configs?.recommended?.rules) {
  config.push({
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
    },
  });
}

// Layer 5 test packs run under Node.js / Playwright — not Vite browser context.
// These rules assume src/ code; they must not fire on test-pack files.
config.push({
  files: ['tests/**/*.{ts,tsx}'],
  rules: {
    // Test packs run in Node.js where process.env is correct; import.meta.env is unavailable
    'pace-core-compliance/prefer-import-meta-env': 'off',
    // Layer 5 persistence tests must query RBAC tables directly to verify platform seeding
    'pace-core-compliance/no-direct-rbac-table': 'off',
    // Orchestrator mandates e2e.spec.ts naming; the naming rule doesn't understand that convention
    'pace-core-compliance/test-file-naming': 'off',
  },
});

config.push({
  ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'audit/**', '**/*.cjs'],
});

module.exports = config;
