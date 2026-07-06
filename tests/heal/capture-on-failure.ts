import fs from 'fs';
import path from 'path';
import type { Page, TestInfo } from '@playwright/test';
import { HEAL_LATEST_DIR } from './constants';

/**
 * Call from pilot spec `test.afterEach` when RX_HEAL_CAPTURE=1.
 * Saves DOM snapshot and failure metadata for the heal loop.
 */
export async function captureHealFailureArtifacts(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  if (process.env.RX_HEAL_CAPTURE !== '1') return;
  if (testInfo.status === testInfo.expectedStatus) return;

  const dir = path.join(process.cwd(), HEAL_LATEST_DIR);
  fs.mkdirSync(dir, { recursive: true });

  try {
    const html = await page.content();
    fs.writeFileSync(path.join(dir, 'dom-snapshot.html'), html, 'utf-8');
  } catch {
    // page may already be closed
  }

  const failure = {
    capturedAt: new Date().toISOString(),
    spec: testInfo.file,
    title: testInfo.title,
    project: testInfo.project.name,
    error: testInfo.error?.message ?? 'unknown',
    stack: testInfo.error?.stack,
    durationMs: testInfo.duration,
    retry: testInfo.retry,
    outputDir: testInfo.outputDir,
  };

  fs.writeFileSync(
    path.join(dir, 'failure-meta.json'),
    JSON.stringify(failure, null, 2),
    'utf-8',
  );
}
