import baseConfig from '@solvera/pace-core/playwright';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...baseConfig,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
