import { test as base } from '@playwright/test';
import type { PlayWrightAiFixtureType } from '@midscene/web/playwright';
import { PlaywrightAiFixture } from '@midscene/web/playwright';

/**
 * Playwright test extended with Midscene vision-driven AI fixtures.
 * @see https://midscenejs.com/integrate-with-playwright
 */
export const test = base.extend<PlayWrightAiFixtureType>(
  PlaywrightAiFixture({
    waitForNetworkIdleTimeout: 3000,
    waitForNavigationTimeout: 8000,
    replanningCycleLimit: 40,
  }),
);

export { expect } from '@playwright/test';
