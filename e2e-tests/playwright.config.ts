import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  timeout: 600000,
  expect: {
    timeout: 60000,
    toHaveScreenshot: {
      maxDiffPixels: 100
    },
  },
  globalTimeout: 3600000,
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.JENKINS ? [['junit', { outputFile: './test-results/results.xml' }]] : [['html']],
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.JENKINS === '1' ? 'http://frontend' : 'http://localhost:4200',
    trace: process.env.JENKINS ? 'on' : 'on-first-retry',
    video: process.env.JENKINS ? {
      mode: 'retain-on-failure',
      size: { width: 1920, height: 1080 }
    }: {
      mode: 'retain-on-failure',
      size: { width: 1920, height: 1080 }
    },
    actionTimeout: 60000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      }
    }
  ],
});
