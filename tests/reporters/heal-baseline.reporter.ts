import type { FullConfig, FullResult, Reporter, Suite } from '@playwright/test/reporter';
import { execSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { HEAL_LAST_GREEN_PATH } from '../heal/constants';

/**
 * When RX_HEAL_BASELINE=1 and the run passes, writes test-results/last-green.json.
 * Invoked by heal orchestrator scripts after a successful regression or ground-truth run.
 */
export default class HealBaselineReporter implements Reporter {
  private rootSuite: Suite | undefined;

  onBegin(_config: FullConfig, suite: Suite) {
    this.rootSuite = suite;
  }

  onEnd(result: FullResult) {
    if (process.env.RX_HEAL_BASELINE !== '1') return;
    if (result.status !== 'passed' || !this.rootSuite) return;

    const allTests = this.rootSuite.allTests();
    const failed = allTests.filter((t) => t.outcome() === 'unexpected');
    if (failed.length > 0) return;

    const portalPath =
      process.env.RX_PORTAL_REPO?.trim() ||
      path.resolve(process.cwd(), '../Pm-Doctor-Portal');

    const record = {
      recordedAt: new Date().toISOString(),
      environment: {
        RX_PAD_BASE_URL: process.env.RX_PAD_BASE_URL ?? null,
        RX_PAD_ENTRY_PATH: process.env.RX_PAD_ENTRY_PATH ?? null,
      },
      portal: readGitRef(portalPath),
      testRepo: readGitRef(process.cwd()),
      suite: {
        total: allTests.length,
        passed: allTests.filter((t) => t.outcome() === 'expected').length,
        skipped: allTests.filter((t) => t.outcome() === 'skipped').length,
        durationMs: result.duration,
      },
    };

    const outPath = path.join(process.cwd(), HEAL_LAST_GREEN_PATH);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(record, null, 2), 'utf-8');
    console.log(`[heal] baseline written → ${HEAL_LAST_GREEN_PATH}`);
  }

  printsToStdio(): boolean {
    return false;
  }
}

function readGitRef(repoPath: string): {
  repoPath: string;
  branch: string | null;
  commit: string | null;
} {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
    }).trim();
    const commit = execSync('git rev-parse HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
    }).trim();
    return { repoPath, branch, commit };
  } catch {
    return { repoPath, branch: null, commit: null };
  }
}
