import type { Page } from '@playwright/test';

/** Verbose step logging (default on; set RX_AI_DEBUG=0 to disable). */
export function isAiDebugEnabled(): boolean {
  return process.env.RX_AI_DEBUG !== '0';
}

export function logMidsceneStepBoundary(
  phase: 'start' | 'ok' | 'fail',
  stepNo: number,
  step: string,
  durationMs?: number,
  error?: unknown,
): void {
  if (!isAiDebugEnabled()) return;

  const prefix = `[test:ai][step ${stepNo}]`;
  const summary = step.length > 120 ? `${step.slice(0, 117)}...` : step;

  if (phase === 'start') {
    console.log(`${prefix} START — ${summary}`);
    return;
  }

  const timing = durationMs != null ? ` (${(durationMs / 1000).toFixed(1)}s)` : '';

  if (phase === 'ok') {
    console.log(`${prefix} OK${timing}`);
    return;
  }

  const message =
    error instanceof Error ? error.message : error ? String(error) : 'unknown error';
  console.log(`${prefix} FAIL${timing} — ${message}`);
}

export async function capturePageDebugState(
  page: Page,
  label: string,
): Promise<void> {
  if (!isAiDebugEnabled()) return;

  const url = page.url();
  console.log(`[test:ai][state:${label}] url=${url}`);

  const toastTexts = await page
    .locator('.ant-message-notice-content, .ant-notification-notice-message')
    .allTextContents()
    .catch(() => []);

  if (toastTexts.length > 0) {
    console.log(
      `[test:ai][state:${label}] toasts=${JSON.stringify(toastTexts.slice(0, 6))}`,
    );
  }

  const headerButtons = await page
    .getByRole('button', { name: /complete|end visit|go to appointment/i })
    .allTextContents()
    .catch(() => []);

  if (headerButtons.length > 0) {
    console.log(
      `[test:ai][state:${label}] header-actions=${JSON.stringify(headerButtons)}`,
    );
  }
}

export function isScenarioGoalUrl(page: Page, urlFragment?: string): boolean {
  if (!urlFragment?.trim()) return false;
  return page.url().includes(urlFragment.trim());
}
