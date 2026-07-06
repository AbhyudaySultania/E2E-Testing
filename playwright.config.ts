import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
import { AUTH_STORAGE_PATH } from './tests/auth.constants';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const healRun = process.env.RX_HEAL_RUN === '1';
const healBaseline = process.env.RX_HEAL_BASELINE === '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ...(healRun ? [['list'] as const] : []),
    ['html'],
    ...(healRun
      ? ([
          [
            'json',
            { outputFile: 'test-results/heal/playwright-results.json' },
          ],
        ] as const)
      : []),
    ...(healRun
      ? [['./tests/reporters/heal-failure.reporter.ts'] as const]
      : []),
    ...(healBaseline
      ? [['./tests/reporters/heal-baseline.reporter.ts'] as const]
      : []),
    [
      '@midscene/web/playwright-reporter',
      { type: 'merged' },
    ],
    ['./tests/reporters/skip-analysis.reporter.ts'],
    ['./tests/reporters/blocker-log.reporter.ts'],
  ],
  use: {
    baseURL:
      process.env.RX_PAD_BASE_URL ??
      'https://pm-uat-doctor-portal.tatvacare.in',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STORAGE_PATH,
      },
      dependencies: ['setup'],
      testIgnore: [/example\.spec\.ts/, /tests\/ai\//],
    },
  ],
});
