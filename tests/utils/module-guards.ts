import { test, type Locator, type Page } from '@playwright/test';
import { moduleBoxByTitle } from '../helpers/test-id-locator';

function moduleBoxLocator(page: Page, titlePattern: RegExp): Locator {
  return page
    .locator('.prescription-box-sm')
    .filter({ has: page.locator('.title-common').filter({ hasText: titlePattern }) })
    .first();
}

function resolveModuleBox(page: Page, moduleTitle: string | RegExp): Locator {
  if (typeof moduleTitle === 'string') {
    if (moduleTitle === 'Symptoms') {
      return moduleBoxLocator(page, /^symptoms\b/i);
    }
    if (moduleTitle === 'Clinical Advices') {
      return moduleBoxByTitle(page, moduleTitle, /clinical advices|advices/i);
    }
    // Vitals module title varies by portal version:
    // UAT: "Body Metrics & Composition" / Local: "Vitals & Body Composition"
    if (moduleTitle === 'Body Metrics & Composition') {
      return moduleBoxByTitle(page, moduleTitle, /body metrics|vitals.*composition|composition/i);
    }
    const titlePattern = new RegExp(moduleTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return moduleBoxByTitle(page, moduleTitle, titlePattern);
  }
  return moduleBoxLocator(page, moduleTitle);
}

/** Collapse left-rail Past Visit Data — reduces layout noise on long-history patients. */
export async function collapsePastVisitDataIfExpanded(page: Page) {
  const pastVisit = page.locator('button').filter({ hasText: /past visit data/i }).first();
  if (!(await pastVisit.isVisible({ timeout: 2_000 }).catch(() => false))) {
    return;
  }
  if ((await pastVisit.getAttribute('aria-expanded')) !== 'false') {
    await pastVisit.click();
    await page.waitForTimeout(300);
  }
}

/** Scroll Rx pad containers — Diet and other bottom modules are below the fold. */
export async function scrollPrescriptionPad(page: Page) {
  await page.evaluate(() => {
    const selectors = ['.scroll-y-hidden', '.prescription-wrapper', 'main', '.wrapper2'];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        if (node instanceof HTMLElement) {
          node.scrollTop = node.scrollHeight;
        }
      });
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(300);
}

export async function scrollModuleIntoView(
  page: Page,
  moduleTitle: string | RegExp,
): Promise<Locator> {
  const moduleBox = resolveModuleBox(page, moduleTitle);
  await moduleBox.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => undefined);

  if (!(await moduleBox.isVisible({ timeout: 2_000 }).catch(() => false))) {
    await scrollPrescriptionPad(page);
    await moduleBox.scrollIntoViewIfNeeded({ timeout: 10_000 });
  }

  return moduleBox;
}

/**
 * Returns true if the module box is visible — non-throwing alternative to
 * skipIfModuleNotVisible. Use in mega-specs where one absent module should not
 * skip the entire test.
 */
export async function isModuleVisible(
  page: Page,
  moduleTitle: string | RegExp,
): Promise<boolean> {
  await scrollPrescriptionPad(page);
  const moduleBox = await scrollModuleIntoView(page, moduleTitle);
  return moduleBox.isVisible({ timeout: 8_000 }).catch(() => false);
}

/**
 * Skip the current test when a prescription module is not rendered for the account.
 * Writes reason for the skip-analysis reporter.
 */
export async function skipIfModuleNotVisible(
  page: Page,
  moduleTitle: string | RegExp,
  options?: { scrollToBottom?: boolean },
): Promise<void> {
  if (options?.scrollToBottom) {
    await scrollPrescriptionPad(page);
  }

  const moduleBox = await scrollModuleIntoView(page, moduleTitle);

  const visible = await moduleBox.isVisible({ timeout: 10_000 }).catch(() => false);

  if (!visible) {
    test.skip(
      true,
      `Module not visible for this account: ${String(moduleTitle)}`,
    );
  }
}
