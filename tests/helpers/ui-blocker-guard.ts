import fs from 'fs';
import path from 'path';
import { expect, type Locator, type Page } from '@playwright/test';
import { UI_BLOCKER_DOM_REMOVE_SELECTORS } from '../fixtures/ui-blockers';
import {
  installPremiumPopupGuard,
  purgeUiBlockers,
} from './premium-popup-guard';

export type BlockerLogEntry = {
  blockerId: string;
  action: string;
  context?: string;
  timestamp: string;
};

const blockerLog: BlockerLogEntry[] = [];

export function recordBlockerDismissal(
  blockerId: string,
  action: string,
  context?: string,
) {
  blockerLog.push({
    blockerId,
    action,
    context,
    timestamp: new Date().toISOString(),
  });
}

export function getBlockerLog(): BlockerLogEntry[] {
  return [...blockerLog];
}

export function resetBlockerLog() {
  blockerLog.length = 0;
}

export function flushBlockerLogToDisk(outputDir = path.resolve(process.cwd(), 'test-results')) {
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, 'blocker-log.json');
  const payload = {
    generatedAt: new Date().toISOString(),
    totalEvents: blockerLog.length,
    events: blockerLog,
  };
  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2));
}

/**
 * MoEngage + Talkative only — safe to call during dropdowns / product modals.
 */
export async function purgeInterceptorsOnly(page: Page, context?: string) {
  await purgeUiBlockers(page);
  await removeDomBlockers(page);
  recordBlockerDismissal('moengage-premium', 'purge', context);
  recordBlockerDismissal('talkative-chat', 'purge', context);
}

/**
 * Install third-party popup guards (MoEngage/Talkative). No broad modal handlers.
 */
export async function installUiBlockerGuard(page: Page): Promise<void> {
  await installPremiumPopupGuard(page);
}

/**
 * Dismiss known third-party / onboarding blockers. Does NOT click generic "Close" buttons
 * (that would close appointment drawers and vaccination modals).
 */
export async function dismissKnownBlockers(page: Page, context?: string) {
  await purgeInterceptorsOnly(page, context);

  const doLater = page.getByRole('button', { name: /do later/i });
  if (await doLater.isVisible({ timeout: 800 }).catch(() => false)) {
    await doLater.click({ force: true }).catch(() => undefined);
    recordBlockerDismissal('document-verification', 'click-do-later', context);
  }

  const disclaimerClose = page
    .locator('.cvt-info, .disclaimer')
    .locator('.icon-Cross, i.icon-Cross')
    .first();
  if (await disclaimerClose.isVisible({ timeout: 500 }).catch(() => false)) {
    await disclaimerClose.click({ force: true }).catch(() => undefined);
    recordBlockerDismissal('appointment-disclaimer', 'click-close', context);
  }

  if (await page.getByText(/past time slot/i).isVisible({ timeout: 400 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    recordBlockerDismissal('past-time-slot', 'escape', context);
  }

  const tourOkay = page.locator('.ant-tour').getByRole('button', { name: /^okay$/i });
  if (await tourOkay.isVisible({ timeout: 400 }).catch(() => false)) {
    await tourOkay.click({ force: true }).catch(() => undefined);
    recordBlockerDismissal('tour-okay', 'click-okay', context);
  }

  const tourClose = page.locator('.ant-tour-close, .ant-popover-close').first();
  if (await tourClose.isVisible({ timeout: 400 }).catch(() => false)) {
    await tourClose.click({ force: true }).catch(() => undefined);
    recordBlockerDismissal('ant-tour', 'click-close', context);
  }

  const talkativeClose = page.getByRole('button', { name: /close talkative widget/i });
  if (await talkativeClose.isVisible({ timeout: 400 }).catch(() => false)) {
    await talkativeClose.click({ force: true }).catch(() => undefined);
    recordBlockerDismissal('talkative-chat', 'click-close', context);
  }
}

async function removeDomBlockers(page: Page) {
  await page.evaluate((selectors) => {
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => node.remove());
    }
  }, UI_BLOCKER_DOM_REMOVE_SELECTORS);
  recordBlockerDismissal('webpack-dev-overlay', 'dom-remove', 'purge');
}

const INTERACTION_FAILURE =
  /intercepts pointer events|not stable|outside of the viewport|timeout.*click/i;

/**
 * Purge third-party overlays → click → on failure purge again and evaluate-click.
 * Retry never runs full dismissKnownBlockers (avoids closing open menus/drawers).
 */
export async function clickResilient(
  page: Page,
  locator: Locator,
  options?: { label?: string; timeout?: number },
) {
  const label = options?.label ?? 'click';
  const timeout = options?.timeout ?? 10_000;

  await purgeInterceptorsOnly(page, label);

  try {
    await locator.click({ timeout });
    return;
  } catch (error) {
    if (!INTERACTION_FAILURE.test(String(error))) {
      throw error;
    }
    await purgeInterceptorsOnly(page, `${label}-retry`);
    await locator.evaluate((el) => (el as HTMLElement).click());
    recordBlockerDismissal('click-resilient', 'evaluate-click', label);
  }
}

/**
 * Try locators in order — first visible match gets a resilient click.
 */
export async function clickFirstResilient(
  page: Page,
  locatorFactories: Array<() => Locator>,
  label: string,
) {
  await dismissKnownBlockers(page, label);

  for (const factory of locatorFactories) {
    const candidate = factory();
    if (await candidate.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await clickResilient(page, candidate, { label });
      return;
    }
  }

  const fallback = locatorFactories[locatorFactories.length - 1]();
  await expect(fallback).toBeVisible({ timeout: 10_000 });
  await clickResilient(page, fallback, { label: `${label}-fallback` });
}

/** Rx-pad specific blockers (dose calculator, previously prescribed alert). */
export async function dismissPrescriptionBlockers(page: Page, context?: string) {
  const doseCalcDialog = page.getByRole('dialog').filter({
    hasText: /dose calculator/i,
  });
  if (await doseCalcDialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
    const closeBtn = doseCalcDialog.locator('.btn-delete-prescription, .icon-Cross').first();
    await closeBtn.click({ force: true }).catch(() => undefined);
    recordBlockerDismissal('dose-calculator', 'click-close', context);
  }

  const alert = page
    .getByRole('alert')
    .filter({ hasText: /previously prescribed|last prescription/i });
  if (await alert.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await alert.getByRole('button', { name: /^ok$/i }).click({ force: true }).catch(() => undefined);
    recordBlockerDismissal('previously-prescribed-alert', 'click-ok', context);
  }
}
