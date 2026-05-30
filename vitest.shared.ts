import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * `.test.ts` files that use renderHook, document, or DOM APIs and require happy-dom.
 * Add paths relative to project root when a hook unit test needs DOM.
 */
export const domUnitTestTsFiles: string[] = [
  'src/hooks/useOrgFormsData.test.ts',
  'src/hooks/useCommsLogRbac.test.ts',
];

export const resolveAlias = {
  '@test-utils': path.resolve(repoRoot, 'src/test-utils.ts'),
  '@': path.resolve(repoRoot, './src'),
};

/** Align with vite.config.ts so linked @solvera/pace-core does not load a second React in tests. */
export const vitestResolve = {
  alias: resolveAlias,
  dedupe: ['react', 'react-dom', 'react-router-dom'] as const,
};

export const vitestOptimizeDeps = {
  exclude: ['@solvera/pace-core', 'react-router-dom'],
};

export const coverageConfig = {
  provider: 'v8' as const,
  reporter: ['text', 'html'],
  include: ['src/**/*.ts', 'src/**/*.tsx'],
  exclude: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.integration.test.ts',
    '**/*.integration.test.tsx',
    '**/*.spec.ts',
    '**/index.ts',
    '**/dist/**',
    '**/coverage/**',
    '**/node_modules/**',
    'src/main.tsx',
  ],
  thresholds: {
    /** Pure utilities (when present). */
    'src/utils/**/*.ts': { statements: 90, lines: 90 },
    /**
     * Domain lib subfolders targeted by meaningful-coverage work (see team testing notes).
     * Global lib gate remains until all lib folders meet a higher bar.
     */
    /** Baseline after template-store tests; raise when teamReporting.execution gains coverage. */
    'src/lib/reports/**/*.ts': { statements: 66, lines: 66 },
    /** Baseline after orgForms.persist tests; raise when mappers.payload/authoring are covered. */
    'src/lib/forms/**/*.ts': { statements: 47, lines: 47 },
    'src/lib/approvals/**/*.ts': { statements: 70, lines: 70 },
    /**
     * Data hooks without dedicated tests are exercised via page integration tests with mocked
     * Supabase/RBAC at the page boundary (Standard 8 hooks ≥90% deferred intentionally).
     * Add hook tests only for non-trivial RBAC/query branching (e.g. useCommsLogRbac).
     */
    'src/lib/**/*.ts': { statements: 63, lines: 63 },
    'src/components/**/*.tsx': { statements: 70, lines: 70 },
    'src/pages/**/*.{ts,tsx}': { statements: 75, lines: 75 },
  },
};

export const sharedTestOptions = {
  pool: 'threads' as const,
  testTimeout: 10000,
  hookTimeout: 10000,
  teardownTimeout: 5000,
  globals: false,
  css: false,
  deps: {
    optimizer: {
      web: {
        include: ['react', 'react-dom', '@testing-library/react', '@testing-library/user-event'],
      },
    },
  },
};

export const unitInclude = ['src/**/*.test.ts', 'src/**/*.spec.ts'];

export const unitExclude = [
  '**/*.integration.test.ts',
  '**/*.integration.test.tsx',
  ...domUnitTestTsFiles,
];

export const domInclude = [
  'src/**/*.test.tsx',
  'src/**/*.spec.tsx',
  'src/**/*.integration.test.ts',
  'src/**/*.integration.test.tsx',
  ...domUnitTestTsFiles,
];
