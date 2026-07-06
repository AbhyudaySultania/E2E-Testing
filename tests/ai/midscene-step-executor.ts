import {
  capturePageDebugState,
  isAiDebugEnabled,
  logMidsceneStepBoundary,
} from './midscene-debug';
import {
  isEndVisitStep,
  isPrintPreviewWaitStep,
  waitForPrintPreviewNavigation,
} from './midscene-prescription-prep';
import type { Page } from '@playwright/test';

type MidsceneAct = (prompt: string) => Promise<unknown>;
type MidsceneWaitFor = (
  condition: string,
  options?: { timeoutMs?: number },
) => Promise<unknown>;

export type MidsceneStepContext = {
  stepNo: number;
  page: Page;
};

function isWaitStep(step: string): boolean {
  return /^wait until\b/i.test(step.trim());
}

function waitConditionFromStep(step: string): string {
  return step.replace(/^wait until\s+/i, '').trim();
}

/**
 * Run one markdown scenario step through Midscene (vision + NL).
 * Post-Complete URL wait uses Playwright only as a navigation outcome check.
 */
export async function executeMidsceneStep(
  step: string,
  ai: MidsceneAct,
  aiWaitFor: MidsceneWaitFor,
  ctx: MidsceneStepContext,
): Promise<void> {
  const { stepNo, page } = ctx;
  const started = Date.now();

  if (isPrintPreviewWaitStep(step) && page.url().includes('prescription_print_view')) {
    if (isAiDebugEnabled()) {
      console.log(`[test:ai][step ${stepNo}] skip aiWaitFor — already on print preview`);
    }
    logMidsceneStepBoundary('ok', stepNo, step, Date.now() - started);
    await capturePageDebugState(page, `after-${stepNo}-wait`);
    return;
  }

  if (isWaitStep(step)) {
    if (isAiDebugEnabled()) {
      console.log(`[test:ai][step ${stepNo}] engine=aiWaitFor`);
    }
    await aiWaitFor(waitConditionFromStep(step), { timeoutMs: 90_000 });
    logMidsceneStepBoundary('ok', stepNo, step, Date.now() - started);
    await capturePageDebugState(page, `after-${stepNo}-wait`);
    return;
  }

  if (isAiDebugEnabled()) {
    console.log(`[test:ai][step ${stepNo}] engine=ai`);
  }

  await ai(step);

  if (isEndVisitStep(step)) {
    await waitForPrintPreviewNavigation(page, stepNo);
  }

  logMidsceneStepBoundary('ok', stepNo, step, Date.now() - started);
  await capturePageDebugState(page, `after-${stepNo}`);
}
