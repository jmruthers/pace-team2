import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {
  coverageConfig,
  domInclude,
  sharedTestOptions,
  unitInclude,
  vitestOptimizeDeps,
  vitestResolve,
} from './vitest.shared.js';

const domEnvironmentGlobs = domInclude.map((pattern) => [pattern, 'happy-dom'] as [string, string]);

export default defineConfig({
  configLoader: 'runner',
  plugins: [react()],
  resolve: vitestResolve,
  optimizeDeps: vitestOptimizeDeps,
  test: {
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    ...sharedTestOptions,
    environment: 'node',
    environmentMatchGlobs: domEnvironmentGlobs,
    setupFiles: ['./src/test-setup.ts'],
    include: [...unitInclude, ...domInclude],
    coverage: coverageConfig,
  },
});
