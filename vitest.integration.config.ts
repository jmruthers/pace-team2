import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { domInclude, sharedTestOptions, vitestOptimizeDeps, vitestResolve } from './vitest.shared.js';

export default defineConfig({
  configLoader: 'runner',
  plugins: [react()],
  resolve: vitestResolve,
  optimizeDeps: vitestOptimizeDeps,
  test: {
    ...sharedTestOptions,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    include: domInclude,
  },
});
