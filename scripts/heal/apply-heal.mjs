#!/usr/bin/env node
/**
 * Apply proposed.patch with backup, approval gates, verify, ground truth, rollback.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  PATHS,
  HEAL_ROOT,
  readJson,
  log,
  promptYesNo,
  parsePatchFilePaths,
  backupFiles,
  runPlaywright,
} from './lib.mjs';
import { rollbackHeal } from './rollback-heal.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolvePatchPath(session) {
  const rel = session.proposed_patch_path;
  const candidates = [
    path.join(HEAL_ROOT, rel),
    path.join(PATHS.sessionsDir, session.session_id, 'proposed.patch'),
    path.join(PATHS.latestDir, 'proposed.patch'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function applyPatch(patchPath) {
  const content = fs.readFileSync(patchPath, 'utf-8');
  if (content.includes('# Cursor Agent') && !content.includes('@@')) {
    return { ok: false, error: 'proposed.patch is still a placeholder — run Cursor Agent first.' };
  }

  const check = spawnSync('git', ['apply', '--check', patchPath], {
    cwd: HEAL_ROOT,
    encoding: 'utf-8',
  });

  if (check.status !== 0) {
    const patch = spawnSync('patch', ['-p1', '--forward', '-i', patchPath], {
      cwd: HEAL_ROOT,
      encoding: 'utf-8',
    });
    if (patch.status !== 0) {
      return {
        ok: false,
        error: `git apply and patch failed:\n${check.stderr}\n${patch.stderr}`,
      };
    }
    return { ok: true, method: 'patch' };
  }

  const apply = spawnSync('git', ['apply', patchPath], {
    cwd: HEAL_ROOT,
    encoding: 'utf-8',
  });
  if (apply.status !== 0) {
    return { ok: false, error: apply.stderr || 'git apply failed' };
  }
  return { ok: true, method: 'git apply' };
}

function writeHealArchive(session, result) {
  const archivePath = path.join(
    PATHS.sessionsDir,
    `heal-${session.session_id}.md`,
  );
  const body = `# Heal complete — ${session.session_id}

## Classification

- Label: **${session.classification}**
- Confidence: **${session.confidence}** (${session.confidence_tier})

## Results

| Step | Status |
|------|--------|
| Patch applied | ${result.applied ? 'yes' : 'no'} |
| Verify tier | ${result.verifyPassed ? 'passed' : 'failed'} |
| Ground truth | ${result.groundTruthPassed ? 'passed' : 'failed'} |
| Failures before | ${result.failuresBefore} |
| Failures after | ${result.failuresAfter} |
| Rolled back | ${result.rolledBack ? 'yes' : 'no'} |

## Patch

\`${session.proposed_patch_path}\`
`;
  fs.writeFileSync(archivePath, body, 'utf-8');
  log(`archive → ${archivePath}`);
}

async function main() {
  const session = readJson(path.join(PATHS.latestDir, 'heal-session.json'));
  if (!session?.failed_spec) {
    console.error('[heal] No heal-session.json — run npm run test:regression:heal first.');
    process.exit(1);
  }

  const patchPath = resolvePatchPath(session);
  if (!fs.existsSync(patchPath)) {
    console.error(`[heal] Missing proposed.patch at ${patchPath}`);
    process.exit(1);
  }

  const patchContent = fs.readFileSync(patchPath, 'utf-8');
  const touchedFiles = parsePatchFilePaths(patchContent);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('HEAL APPLY — review before approval');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`Spec:     ${session.failed_spec}`);
  console.log(`Test:     ${session.failed_test_title}`);
  console.log(`Class:    ${session.classification} (confidence ${session.confidence})`);
  console.log(`Patch:    ${patchPath}`);
  console.log(`Files:    ${touchedFiles.join(', ') || '(parse patch for paths)'}`);
  console.log('──────────────────────────────────────────────────────────');
  console.log(patchContent.slice(0, 4000));
  if (patchContent.length > 4000) console.log('... [truncated]');
  console.log('══════════════════════════════════════════════════════════\n');

  if (session.confidence < 70) {
    log(`LOW CONFIDENCE (${session.confidence}) — business/API/assertion risk.`);
    const lowOk = await promptYesNo('Low confidence — continue apply anyway?');
    if (!lowOk) {
      log('Stopped.');
      process.exit(0);
    }
  }

  const approved = await promptYesNo('Apply patch?');
  if (!approved) {
    log('Rejected — stopped.');
    process.exit(0);
  }

  const backupDir = path.join(PATHS.latestDir, 'backup');
  if (touchedFiles.length) {
    backupFiles(touchedFiles, backupDir);
    log(`backup → ${backupDir} (${touchedFiles.length} file(s))`);
  }

  const applied = applyPatch(patchPath);
  if (!applied.ok) {
    console.error(`[heal] Apply failed: ${applied.error}`);
    process.exit(1);
  }
  log(`patch applied via ${applied.method}`);

  const failuresBefore = session.regression_failure_count ?? 1;

  log('Re-running failed spec...');
  const specResult = runPlaywright(
    ['test', session.failed_spec, '--reporter=list'],
    { RX_HEAL_CAPTURE: '0' },
  );
  if (specResult.status !== 0) {
    rollbackHeal({
      reason: 'Failed spec still failing after patch',
      session,
    });
    process.exit(1);
  }

  log('Running verify tier...');
  process.env.RX_HEAL_FAILED_SPEC = session.failed_spec;
  const verifyScript = path.join(__dirname, 'verify-heal.mjs');
  const verify = spawnSync(process.execPath, [verifyScript], {
    cwd: HEAL_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (verify.status !== 0) {
    rollbackHeal({ reason: 'Verify tier failed', session });
    process.exit(1);
  }

  log('Running ground truth...');
  const gtScript = path.join(__dirname, 'update-baseline.mjs');
  const ground = spawnSync(process.execPath, [gtScript], {
    cwd: HEAL_ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  const result = {
    applied: true,
    verifyPassed: verify.status === 0,
    groundTruthPassed: ground.status === 0,
    failuresBefore,
    failuresAfter: ground.status === 0 ? 0 : failuresBefore,
    rolledBack: false,
  };

  if (ground.status !== 0) {
    result.rolledBack = true;
    result.failuresAfter = failuresBefore + 1;
    rollbackHeal({
      reason: 'Ground truth failed — failure count would increase',
      session,
    });
    process.exit(1);
  }

  writeHealArchive(session, result);
  log('Heal complete. Commit unstaged changes manually.');
  process.exit(0);
}

main();
