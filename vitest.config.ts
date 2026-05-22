import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Layer 5 test packs in tests/ run via `npm run test:pack` (Playwright)
      // or `vitest --config vitest.persistence.config.ts` (persistence).
      // Exclude them from the default vitest run so they don't fail without
      // a real Supabase connection or Playwright environment.
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        'tests/**',
      ],
      testTimeout: 10000,
      hookTimeout: 10000,
      teardownTimeout: 5000,
      coverage: {
        provider: 'istanbul',
        include: ['src/**'],
        exclude: ['src/**/*.test.*', 'src/**/*.spec.*', 'src/**/*.d.ts'],
      },
    },
  }),
);
