import type { Locator, Page } from '@playwright/test';
import {
  RX_MODULE_BOX_BY_TITLE,
  RX_TEST_IDS,
  type RxTestId,
} from '../fixtures/test-ids';

/** Prefer stable data-testid; fall back to legacy selector when portal build lacks ids. */
export function locatorByTestIdOr(
  page: Page,
  testId: string,
  fallback: Locator,
): Locator {
  return page.getByTestId(testId).or(fallback);
}

/**
 * SmartRx split dropdown → Consult menuitem.
 * Clicks the menuitem (visible), not the inner rx-consult-menu span — avoids strict-mode
 * overlap with getByRole('menuitem') when Phase B testids are present.
 */
export function consultMenuItem(page: Page): Locator {
  return page
    .locator(
      `[role="menuitem"]:has([data-testid="${RX_TEST_IDS.CONSULT_MENU}"]), [role="menuitem"]`,
    )
    .filter({ hasText: /^consult$/i })
    .first();
}

/**
 * SmartRx split chevron / dropdown trigger — one element whether or not rx-consult-split exists.
 */
export function consultSplitTrigger(scope: Locator): Locator {
  return scope
    .locator(
      `[data-testid="${RX_TEST_IDS.CONSULT_SPLIT}"], .consult-btns-group a`,
    )
    .first();
}

export function moduleBoxByTitle(
  page: Page,
  title: string,
  titlePattern?: RegExp,
): Locator {
  const testId = RX_MODULE_BOX_BY_TITLE[title];
  const pattern = titlePattern ?? new RegExp(title, 'i');
  const fallback = page
    .locator('.prescription-box-sm')
    .filter({ hasText: pattern })
    .first();

  return testId ? locatorByTestIdOr(page, testId, fallback) : fallback;
}

export function moduleEntryButton(
  box: Locator,
  testId: RxTestId | undefined,
  label: RegExp,
): Locator {
  const fallback = box.getByRole('button', { name: label });
  return testId ? box.getByTestId(testId).or(fallback) : fallback;
}
