import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { sharedTestOptions, unitExclude, unitInclude, vitestOptimizeDeps, vitestResolve } from './vitest.shared.js';

export default defineConfig({
  plugins: [react()],
  resolve: vitestResolve,
  optimizeDeps: vitestOptimizeDeps,
  test: {
    ...sharedTestOptions,
    environment: 'node',
    setupFiles: ['./src/test-setup-unit.ts'],
    include: unitInclude,
    exclude: unitExclude,
  },
});
