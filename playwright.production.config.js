import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Run npm run build first. This exercises the actual static bundle, not Vite dev.
export default defineConfig({
  ...base,
  testMatch: 'phase3.spec.js',
  outputDir: 'test-results/production',
  grep: /guided presentation/,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4174' },
  webServer: {
    command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run preview -- --port 4174 --strictPort`,
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
});
