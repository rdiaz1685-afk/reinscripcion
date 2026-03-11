import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Playwright configuration for Innovat automation tests
 */
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.test.ts',
  fullyParallel: false, // Run tests sequentially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for exploration tests
  workers: 1, // Single worker to avoid browser conflicts
  reporter: [['list'], ['html', { open: 'never' }]], // Don't auto-open HTML report
  
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Timeout settings
  timeout: 120000, // 2 minutes per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },
});
