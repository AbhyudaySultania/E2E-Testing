import type { Page } from '@playwright/test';
import { isAiDebugEnabled } from './midscene-debug';

/** True only for steps whose primary action is clicking Complete / End Visit. */
export function isEndVisitStep(step: string): boolean {
  if (/^wait until\b/i.test(step)) return false;

  const trimmed = step.trim();
  if (!/^click\b/i.test(trimmed)) return false;

  return /\b(complete|end visit)\b/i.test(trimmed);
}

export function isPrintPreviewWaitStep(step: string): boolean {
  return (
    /^wait until\b/i.test(step) &&
    /print preview|print prescription|prescription_print_view/i.test(step)
  );
}

export async function waitForPrintPreviewNavigation(
  page: Page,
  stepNo: number,
): Promise<void> {
  if (page.url().includes('prescription_print_view')) {
    if (isAiDebugEnabled()) {
      console.log(`[test:ai][step ${stepNo}] already on print preview URL`);
    }
    return;
  }

  try {
    await page.waitForURL(/prescription_print_view/, { timeout: 60_000 });
    if (isAiDebugEnabled()) {
      console.log(`[test:ai][step ${stepNo}] navigated to print preview after Complete`);
    }
    return;
  } catch {
    const current = page.url();
    const onAppointmentsHome =
      /^https?:\/\/[^/]+\/?$/.test(current) && !current.includes('prescription');

    if (onAppointmentsHome) {
      throw new Error(
        'Left print preview flow — now on appointments dashboard (/). ' +
          'After Complete, do not click "Go to Appointment" until the print preview step finishes.',
      );
    }

    if (current.includes('/prescription') && !current.includes('print_view')) {
      throw new Error(
        'Still on prescription pad after Complete — save may not have finished, ' +
          'or Complete was not clicked. Stay on page until /prescription_print_view loads.',
      );
    }

    throw new Error(
      `Expected /prescription_print_view after Complete but URL is ${current}`,
    );
  }
}
