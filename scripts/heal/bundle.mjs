import fs from 'node:fs';
import path from 'node:path';
import {
  PATHS,
  ensureDir,
  readJson,
  writeJson,
  isPilotSpec,
  log,
} from './lib.mjs';
import { classifyFailureV2 } from './classify-failure.mjs';

export { classifyFailureV2 as classifyFailure };

/**
 * Parse Playwright JSON report and return failed tests (first failure for heal loop).
 */
export function parseFailures(resultsPath = PATHS.resultsJson) {
  const fromReporter = readJson(path.join(PATHS.latestDir, 'failure.json'));
  if (fromReporter?.specFile) {
    return { failures: [normalizeFailure(fromReporter)], total: 1 };
  }

  const data = readJson(resultsPath);
  const failures = [];

  if (data?.suites) {
    walkJsonSuites(data.suites, failures);
  }

  if (failures.length === 0 && data?.files) {
    for (const file of data.files) {
      for (const test of file.tests ?? []) {
        for (const result of test.results ?? []) {
          if (isFailedStatus(result.status)) {
            failures.push({
              specFile: file.fileName ?? file.file,
              title: test.testName ?? test.title,
              project: test.projectName,
              status: result.status,
              error: result.error?.message ?? result.errors?.[0]?.message ?? 'unknown',
              stack: result.error?.stack ?? result.errors?.[0]?.stack,
              durationMs: result.duration,
            });
          }
        }
      }
    }
  }

  if (failures.length === 0) {
    const fromErrorContext = parseErrorContextArtifacts();
    if (fromErrorContext) failures.push(fromErrorContext);
  }

  if (failures.length === 0) {
    const meta = readJson(path.join(PATHS.latestDir, 'failure-meta.json'));
    if (meta?.spec) {
      failures.push({
        specFile: meta.spec,
        title: meta.title,
        status: 'failed',
        error: meta.error,
        stack: meta.stack,
        durationMs: meta.durationMs,
      });
    }
  }

  return { failures, total: failures.length };
}

/**
 * All hard failures from Playwright JSON report (excludes flaky — passed on retry).
 */
export function parseAllHardFailures(resultsPath = PATHS.resultsJson) {
  const data = readJson(resultsPath);
  const failures = [];
  const seen = new Set();

  if (data?.suites) {
    walkJsonSuitesHard(data.suites, failures, seen);
  }

  if (failures.length === 0 && data?.files) {
    for (const file of data.files) {
      for (const test of file.tests ?? []) {
        if (!isHardFailureResults(test.results)) continue;
        const last = test.results[test.results.length - 1];
        const specFile = (file.fileName ?? file.file).replace(/\\/g, '/');
        const key = `${specFile}::${test.testName ?? test.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        failures.push({
          specFile,
          title: test.testName ?? test.title,
          project: test.projectName,
          status: last.status,
          error: last.error?.message ?? last.errors?.[0]?.message ?? 'unknown',
          stack: last.error?.stack ?? last.errors?.[0]?.stack,
          durationMs: last.duration,
        });
      }
    }
  }

  if (failures.length === 0) {
    const single = parseFailures();
    if (single.failures[0]) failures.push(single.failures[0]);
  }

  return { failures, total: failures.length };
}

function isHardFailureResults(results) {
  if (!results?.length) return false;
  const last = results[results.length - 1];
  return isFailedStatus(last.status);
}

function walkJsonSuitesHard(suites, failures, seen, specFile) {
  for (const suite of suites) {
    const file = suite.file || specFile;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (!isHardFailureResults(test.results)) continue;
        const last = test.results[test.results.length - 1];
        const key = `${file}::${spec.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        failures.push({
          specFile: file,
          title: spec.title,
          project: test.projectName,
          status: last.status,
          error: last.error?.message ?? 'unknown',
          stack: last.error?.stack,
          durationMs: last.duration,
        });
      }
    }
    if (suite.suites?.length) {
      walkJsonSuitesHard(suite.suites, failures, seen, file);
    }
  }
}

function isFailedStatus(status) {
  return status === 'failed' || status === 'timedOut' || status === 'interrupted';
}

function normalizeFailure(raw) {
  return {
    specFile: String(raw.specFile).replace(/\\/g, '/'),
    title: raw.title,
    project: raw.project,
    status: raw.status,
    error: raw.error,
    stack: raw.stack,
    durationMs: raw.durationMs,
  };
}

function walkJsonSuites(suites, failures, specFile) {
  for (const suite of suites) {
    const file = suite.file || specFile;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          if (isFailedStatus(result.status)) {
            failures.push({
              specFile: file,
              title: spec.title,
              project: test.projectName,
              status: result.status,
              error: result.error?.message ?? 'unknown',
              stack: result.error?.stack,
              durationMs: result.duration,
            });
          }
        }
      }
    }
    if (suite.suites?.length) {
      walkJsonSuites(suite.suites, failures, file);
    }
  }
}

/** Scan test-results error-context.md from the latest failure folder. */
export function parseErrorContextArtifacts() {
  const base = path.join(PATHS.latestDir, '..', '..');
  if (!fs.existsSync(base)) return null;

  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.includes('heal'))
    .map((d) => path.join(base, d.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const dir of dirs) {
    const errCtx = path.join(dir, 'error-context.md');
    if (!fs.existsSync(errCtx)) continue;

    const text = fs.readFileSync(errCtx, 'utf-8');
    const location = text.match(/- Location:\s*(.+)/)?.[1]?.trim();
    const name = text.match(/- Name:\s*(.+)/)?.[1]?.trim();
    const errorBlock = text.match(/# Error details\s+```\s*([\s\S]*?)```/)?.[1]?.trim();

    if (!location) continue;

    const specFile = location.replace(/:\d+:\d+$/, '').replace(/\\/g, '/');

    return {
      specFile,
      title: name?.includes('>>') ? name.split('>>').pop()?.trim() ?? name : name ?? 'unknown',
      status: 'failed',
      error: errorBlock ?? 'see error-context.md',
      durationMs: 0,
      source: errCtx,
    };
  }

  return null;
}

export function pickHealTarget(failures) {
  const pilot = failures.find((f) => isPilotSpec(f.specFile));
  if (pilot) return { target: pilot, outOfScope: false };
  if (failures[0]) {
    return { target: failures[0], outOfScope: true };
  }
  return { target: null, outOfScope: false };
}

export function buildFailureBundle(target, regressionSummary) {
  ensureDir(PATHS.latestDir);

  const failureJson = {
    capturedAt: new Date().toISOString(),
    specFile: target.specFile,
    title: target.title,
    project: target.project,
    status: target.status,
    error: target.error,
    stack: target.stack,
    durationMs: target.durationMs,
    regressionFailureCount: regressionSummary?.failureCount ?? 1,
  };

  writeJson(path.join(PATHS.latestDir, 'failure.json'), failureJson);

  const meta = readJson(path.join(PATHS.latestDir, 'failure-meta.json'));
  if (meta) {
    failureJson.domCapture = true;
  }

  copyArtifacts(target);
  return failureJson;
}

function copyArtifacts(_target) {
  const out = PATHS.latestDir;
  const base = path.join(PATHS.latestDir, '..', '..');

  if (!fs.existsSync(base)) return;

  ensureDir(out);

  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(base, d.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const dir of dirs) {
    if (dir.includes('heal')) continue;

    const png = path.join(dir, 'test-failed-1.png');
    if (fs.existsSync(png)) {
      fs.copyFileSync(png, path.join(out, 'before.png'));
    }

    const errCtx = path.join(dir, 'error-context.md');
    if (fs.existsSync(errCtx)) {
      fs.copyFileSync(errCtx, path.join(out, 'error-context.md'));
    }

    const traces = fs.readdirSync(dir).filter((f) => f.endsWith('.zip'));
    if (traces[0]) {
      fs.copyFileSync(path.join(dir, traces[0]), path.join(out, 'trace.zip'));
    }

    if (
      fs.existsSync(path.join(out, 'before.png')) ||
      fs.existsSync(path.join(out, 'error-context.md'))
    ) {
      break;
    }
  }
}

export function writeSessionMarkdown(failure, classification, sessionId) {
  ensureDir(PATHS.sessionsDir);
  const sessionDir = path.join(PATHS.sessionsDir, sessionId);
  ensureDir(sessionDir);

  const mdPath = path.join(PATHS.sessionsDir, `${sessionId}.md`);
  const patchPlaceholder = path.join(sessionDir, 'proposed.patch');

  if (!fs.existsSync(patchPlaceholder)) {
    fs.writeFileSync(
      patchPlaceholder,
      '# Paste unified diff here after Cursor heal proposal\n',
      'utf-8',
    );
  }

  const md = `# Heal session — ${sessionId}

## Failure

| Field | Value |
|-------|-------|
| Spec | \`${failure.specFile}\` |
| Test | ${failure.title} |
| Status | ${failure.status} |
| Duration | ${failure.durationMs}ms |

### Error

\`\`\`
${failure.error}
\`\`\`

## Classification (heuristic)

| Field | Value |
|-------|-------|
| Label | **${classification.label}** |
| Confidence | ${classification.confidence} (${classification.confidenceTier ?? classification.confidence}) |
| Recommended | ${classification.recommendedAction} |

### Evidence

${classification.evidence.map((e) => `- ${e}`).join('\n')}

## Artifacts

- \`test-results/heal/latest/before.png\` — failure screenshot
- \`test-results/heal/latest/dom-snapshot.html\` — DOM (pilot specs + RX_HEAL_CAPTURE)
- \`test-results/heal/latest/classification.json\`
- \`test-results/heal/latest/failure.json\`
- \`${sessionDir}/proposed.patch\` — paste diff after Cursor review

## Heal order (mandatory)

1. Extend \`UI_BLOCKER_REGISTRY\` / \`dismissKnownBlockers\` if popup/banner
2. Use \`clickResilient\` for intercepted clicks
3. Update page object locators (prefer \`rx-*\` testids)
4. Adjust assertions only if business rule changed — never weaken
5. **Do not** edit \`Pm-Doctor-Portal\` — report portal bugs in this doc

## Approval

- Review diff + re-run of failed test before saying yes
- Changes stay **unstaged** — you commit manually
- Reject → stop entirely (v1)

## Portal bugs (if any)

_Describe suspected doctor-portal issues here — no app code edits by heal loop._
`;

  fs.writeFileSync(mdPath, md, 'utf-8');
  log(`session doc → ${mdPath}`);
  return { mdPath, sessionDir, sessionId };
}
