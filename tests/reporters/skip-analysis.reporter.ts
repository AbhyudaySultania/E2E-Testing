import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

type SkipRecord = {
  testId: string;
  title: string;
  file: string;
  reason: string;
  timestamp: string;
};

/**
 * Custom reporter (option A): aggregates skipped tests into test-results/skip-report.json
 */
export default class SkipAnalysisReporter implements Reporter {
  private skipped: SkipRecord[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== 'skipped') return;

    const reason =
      result.error?.message?.replace(/^[\s\S]*?skipped:\s*/i, '').trim() ||
      result.error?.message ||
      'No skip reason provided';

    this.skipped.push({
      testId: test.id,
      title: test.title,
      file: test.location.file,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  onEnd(result: FullResult) {
    const outputDir = path.resolve(process.cwd(), 'test-results');
    fs.mkdirSync(outputDir, { recursive: true });

    const reportPath = path.join(outputDir, 'skip-report.json');
    const payload = {
      generatedAt: new Date().toISOString(),
      totalSkipped: this.skipped.length,
      overallStatus: result.status,
      skipped: this.skipped,
    };

    fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2));
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(_config: FullConfig) {
    // no-op
  }
}
