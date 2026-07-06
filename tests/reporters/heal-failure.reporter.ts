import type {
  FullConfig,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';
import { HEAL_LATEST_DIR } from '../heal/constants';

/**
 * On first test failure during RX_HEAL_RUN, writes test-results/heal/latest/failure.json.
 * Reliable fallback when Playwright JSON report shape changes or is missing.
 */
export default class HealFailureReporter implements Reporter {
  private captured = false;

  onBegin(_config: FullConfig) {
    this.captured = false;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (process.env.RX_HEAL_RUN !== '1') return;
    if (this.captured) return;
    if (result.status === test.expectedStatus) return;
    if (result.status === 'skipped') return;

    const dir = path.join(process.cwd(), HEAL_LATEST_DIR);
    fs.mkdirSync(dir, { recursive: true });

    const specFile = path.relative(process.cwd(), test.location.file).replace(/\\/g, '/');

    const payload = {
      capturedAt: new Date().toISOString(),
      specFile,
      title: test.title,
      project: projectName(test),
      status: result.status,
      error: result.error?.message ?? 'unknown',
      stack: result.error?.stack,
      durationMs: result.duration,
      location: {
        file: test.location.file,
        line: test.location.line,
        column: test.location.column,
      },
      outputDir: result.attachments.find((a) => a.name === 'screenshot')?.path,
    };

    fs.writeFileSync(
      path.join(dir, 'failure.json'),
      JSON.stringify(payload, null, 2),
      'utf-8',
    );

    this.captured = true;
    console.log(`[heal] failure captured → ${HEAL_LATEST_DIR}/failure.json (${specFile})`);
  }

  printsToStdio(): boolean {
    return false;
  }
}

function projectName(test: TestCase): string {
  let suite: Suite | undefined = test.parent;
  while (suite) {
    const project = suite.project();
    if (project) return project.name;
    suite = suite.parent;
  }
  return 'chromium';
}
