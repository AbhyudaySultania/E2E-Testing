import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { AUTH_TOKEN_KEY, AUTH_STORAGE_PATH } from './auth.constants';
import {
  PREMIUM_BLOCKER_INIT_SCRIPT,
  PREMIUM_POPUP_SELECTOR,
  purgeUiBlockers,
} from './helpers/premium-popup-guard';

const BASE_URL =
  process.env.RX_PAD_BASE_URL ?? 'https://pm-uat-doctor-portal.tatvacare.in';

setup('authenticate via authToken', async ({ page, context }) => {
  await context.addInitScript(PREMIUM_BLOCKER_INIT_SCRIPT);
  const jwt = process.env.RX_PAD_JWT;
  if (!jwt?.trim()) {
    throw new Error(
      'RX_PAD_JWT is required. Copy .env.example to .env and paste your UAT JWT.',
    );
  }

  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto(
    `${BASE_URL}/?authToken=${encodeURIComponent(jwt.trim())}`,
    { waitUntil: 'domcontentloaded' },
  );

  // App.js strips authToken from URL after persisting to localStorage
  await expect(page).not.toHaveURL(/authToken=/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

  // Quick check only — do not wait for popup to appear (was blocking ~20s on localhost).
  const premiumPopup = page.locator(PREMIUM_POPUP_SELECTOR);
  if (await premiumPopup.first().isVisible({ timeout: 800 }).catch(() => false)) {
    const closeSvg = premiumPopup.first().locator('svg[data-name="close-popup"]').first();
    if (await closeSvg.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeSvg.click({ force: true });
    } else {
      const closeImg = premiumPopup.first().locator('img').last();
      if (await closeImg.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeImg.click({ force: true });
      }
    }
    await expect(premiumPopup.first()).toBeHidden({ timeout: 3_000 }).catch(() => undefined);
  }
  await purgeUiBlockers(page);

  const storedRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    AUTH_TOKEN_KEY,
  );
  expect(storedRaw, `${AUTH_TOKEN_KEY} must exist in localStorage`).toBeTruthy();

  const parsedToken = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as string;
    } catch {
      return null;
    }
  }, AUTH_TOKEN_KEY);

  expect(parsedToken, 'Token must be a JSON-encoded JWT string').toBeTruthy();
  expect(parsedToken).toMatch(/^eyJ/);

  fs.mkdirSync(path.dirname(AUTH_STORAGE_PATH), { recursive: true });
  await page.context().storageState({ path: AUTH_STORAGE_PATH });
});
