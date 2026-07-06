import type { FullConfig, FullResult, Reporter } from '@playwright/test/reporter';
import { flushBlockerLogToDisk, resetBlockerLog } from '../helpers/ui-blocker-guard';

/**
 * Writes test-results/blocker-log.json after each run (which blockers were dismissed).
 */
export default class BlockerLogReporter implements Reporter {
  onBegin(_config: FullConfig) {
    resetBlockerLog();
  }

  onEnd(_result: FullResult) {
    flushBlockerLogToDisk();
  }

  printsToStdio(): boolean {
    return false;
  }
}
