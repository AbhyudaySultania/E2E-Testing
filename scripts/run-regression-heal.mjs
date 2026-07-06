#!/usr/bin/env node
/**
 * Heal loop V2 entry: run target spec(s) → hard failures → user pick → session + agent context.
 *
 * Target (first match):
 *   node scripts/run-regression-heal.mjs [spec-or-dir]
 *   RX_HEAL_SPEC=tests/regression/diagnosis.spec.ts
 * Default: tests/regression (full suite)
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  PATHS,
  HEAL_ROOT,
  ensureDir,
  readJson,
  runPlaywright,
  promptPickFailure,
  log,
} from './heal/lib.mjs';
import { parseAllHardFailures } from './heal/bundle.mjs';
import { bootstrapHealSession } from './heal/create-heal-session.mjs';
import { buildHealContext } from './heal/build-heal-context.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_HEAL_TARGET = 'tests/regression';

function resolveHealTarget() {
  const fromArg = process.argv[2]?.trim();
  const fromEnv = process.env.RX_HEAL_SPEC?.trim();
  return fromArg || fromEnv || DEFAULT_HEAL_TARGET;
}

const healTarget = resolveHealTarget();
const healLabel =
  healTarget === DEFAULT_HEAL_TARGET ? 'full regression' : healTarget;

ensureDir(path.dirname(PATHS.resultsJson));
ensureDir(PATHS.latestDir);

log(`V2 — Step 1: ${healLabel} (headless unless RX_HEAL_HEADED=1)`);

const regression = runPlaywright(['test', healTarget], {
  RX_HEAL_RUN: '1',
  RX_HEAL_CAPTURE: '1',
  RX_HEAL_BASELINE: '1',
});

if (regression.status === 0) {
  log(`Target passed — baseline written (test-results/last-green.json).`);
  if (healTarget !== DEFAULT_HEAL_TARGET) {
    log('Note: single-spec green does not prove full regression; run test:heal:ground-truth after apply.');
  }
  process.exit(0);
}

log('Regression failed — collecting hard failures (flaky excluded).');

const { failures, total } = parseAllHardFailures();

if (total === 0) {
  log('No hard failures parsed. Checked:');
  log(`  - ${PATHS.resultsJson}`);
  log(`  - ${PATHS.latestDir}/failure.json`);
  console.error('[heal] Could not parse failures. Check playwright report.');
  process.exit(regression.status ?? 1);
}

log(`${total} hard failure(s) in run.`);

const picked = await promptPickFailure(failures);
if (!picked) {
  console.error('[heal] No failure selected.');
  process.exit(1);
}

const { session, sessionDir } = bootstrapHealSession(picked, {
  failureCount: total,
});

const classification = readJson(path.join(PATHS.latestDir, 'classification.json'));

buildHealContext(session, classification);

log('');
log('══════════════════════════════════════════════════════════');
log('HEAL V2 — session ready');
log('══════════════════════════════════════════════════════════');
log(`Picked: ${session.failed_spec}`);
log(`Classification: ${session.classification} (confidence ${session.confidence})`);
log(`Session dir: ${session.session_dir}`);
log(`Patch path: ${session.proposed_patch_path}`);
log('');
log('Next: Cursor Agent (hook or notify script) → proposed.patch');
log('Then: npm run test:heal:apply');
log('══════════════════════════════════════════════════════════');

const notifyScript = path.join(__dirname, 'heal/notify-agent.mjs');
spawnSync(process.execPath, [notifyScript], {
  cwd: HEAL_ROOT,
  stdio: 'inherit',
});

process.exit(1);
