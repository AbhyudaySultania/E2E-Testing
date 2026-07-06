import fs from 'node:fs';
import path from 'node:path';
import {
  PATHS,
  ensureDir,
  readJson,
  writeJson,
  gitLogSince,
  timestampSlug,
  ALLOWED_EDIT_ROOTS,
  HARD_RULES,
} from './lib.mjs';
import { classifyFailureV2 } from './classify-failure.mjs';
import { buildFailureBundle } from './bundle.mjs';

/**
 * Create heal-session.json for the selected failure (V2).
 */
export function createHealSession({
  failure,
  classification,
  lastGreen,
  regressionFailureCount,
  sessionId,
}) {
  ensureDir(PATHS.latestDir);

  const sessionDir = path.join(PATHS.sessionsDir, sessionId);
  ensureDir(sessionDir);

  const tracePath = fs.existsSync(path.join(PATHS.latestDir, 'trace.zip'))
    ? 'test-results/heal/latest/trace.zip'
    : null;

  const screenshots = [];
  const beforePng = path.join(PATHS.latestDir, 'before.png');
  if (fs.existsSync(beforePng)) {
    screenshots.push('test-results/heal/latest/before.png');
  }

  const portalCommits = lastGreen?.portal?.commit
    ? gitLogSince(PATHS.portalRepo, lastGreen.portal.commit)
    : [];

  const proposedPatchPath = path.join(sessionDir, 'proposed.patch');
  if (!fs.existsSync(proposedPatchPath)) {
    fs.writeFileSync(
      proposedPatchPath,
      '# Cursor Agent: write unified diff here after heal proposal\n',
      'utf-8',
    );
  }

  /** @type {import('./types.ts').HealSessionV2} */
  const session = {
    version: 2,
    session_id: sessionId,
    failed_spec: failure.specFile,
    failed_test_title: failure.title,
    classification: classification.label,
    confidence: classification.confidence,
    confidence_tier: classification.confidenceTier,
    recommended_action: classification.recommendedAction,
    trace_path: tracePath,
    screenshot_paths: screenshots,
    last_green_path: PATHS.lastGreen,
    last_green: lastGreen,
    portal_commits_since_last_green: portalCommits,
    timestamp: new Date().toISOString(),
    regression_failure_count: regressionFailureCount,
    proposed_patch_path: `docs/heal-sessions/${sessionId}/proposed.patch`,
    session_dir: `docs/heal-sessions/${sessionId}`,
    allowed_edit_roots: ALLOWED_EDIT_ROOTS,
    hard_rules: HARD_RULES,
    failure_error: failure.error,
  };

  writeJson(path.join(PATHS.latestDir, 'heal-session.json'), session);
  writeJson(path.join(sessionDir, 'heal-session.json'), session);

  return { session, sessionDir, proposedPatchPath };
}

/**
 * Full V2 session bootstrap for one picked failure.
 */
export function bootstrapHealSession(failure, { failureCount }) {
  const lastGreen = readJson(PATHS.lastGreen);
  const bundle = buildFailureBundle(failure, { failureCount });
  const classification = classifyFailureV2(bundle, lastGreen);

  const slug = failure.specFile
    .replace(/^tests\//, '')
    .replace(/\.spec\.ts$/, '')
    .replace(/[/\\]/g, '-');
  const sessionId = `${timestampSlug()}-${slug}`;

  return createHealSession({
    failure: bundle,
    classification,
    lastGreen,
    regressionFailureCount: failureCount,
    sessionId,
  });
}
