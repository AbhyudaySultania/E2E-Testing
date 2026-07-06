import { test, expect } from '@playwright/test';
import { AUTH_TOKEN_KEY } from './auth.constants';

test.describe('rx-pad authenticated access', () => {
  test('user is authenticated and main shell is visible', async ({ page }) => {
    await page.goto('/');

    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

    const hasToken = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      try {
        const token = JSON.parse(raw) as string;
        return typeof token === 'string' && token.startsWith('eyJ');
      } catch {
        return false;
      }
    }, AUTH_TOKEN_KEY);

    expect(hasToken).toBe(true);

    await expect(
      page.locator('header, .ant-layout, nav').first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
