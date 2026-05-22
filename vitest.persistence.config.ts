import baseConfig from '@solvera/pace-core/configs/vitest.persistence.config';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: ['./vitest.persistence.setup.ts'],
    },
  }),
);
