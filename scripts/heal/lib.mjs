import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const HEAL_ROOT = path.resolve(__dirname, '../..');

export const PATHS = {
  lastGreen: path.join(HEAL_ROOT, 'test-results/last-green.json'),
  latestDir: path.join(HEAL_ROOT, 'test-results/heal/latest'),
  resultsJson: path.join(HEAL_ROOT, 'test-results/heal/playwright-results.json'),
  sessionsDir: path.join(HEAL_ROOT, 'docs/heal-sessions'),
  portalRepo:
    process.env.RX_PORTAL_REPO?.trim() ||
    path.resolve(HEAL_ROOT, '../Pm-Doctor-Portal'),
  playwrightBin: path.join(
    HEAL_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'playwright.cmd' : 'playwright',
  ),
};

export const PILOT_SPECS = [
  'tests/regression/multi-medicine.spec.ts',
  'tests/regression/vitals.spec.ts',
  'tests/create-prescription.spec.ts',
];

export const VERIFY_SPECS = [
  'tests/authenticated-access.spec.ts',
  ...PILOT_SPECS,
];

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function runPlaywright(args, extraEnv = {}) {
  const headed = process.env.RX_HEAL_HEADED === '1';
  const fullArgs = [...args];
  if (headed && !fullArgs.includes('--headed')) {
    fullArgs.push('--headed');
  }

  const env = {
    ...process.env,
    RX_HEAL_CAPTURE: '1',
    ...extraEnv,
  };

  return spawnSync(PATHS.playwrightBin, fullArgs, {
    cwd: HEAL_ROOT,
    stdio: 'inherit',
    env,
  });
}

export function gitRef(repoPath) {
  try {
    const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoPath,
      encoding: 'utf-8',
    }).stdout.trim();
    const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoPath,
      encoding: 'utf-8',
    }).stdout.trim();
    return { repoPath, branch, commit };
  } catch {
    return { repoPath, branch: null, commit: null };
  }
}

export function gitLogSince(repoPath, sinceCommit, fileHint) {
  if (!sinceCommit) return [];
  const args = ['log', `${sinceCommit}..HEAD`, '--oneline', '--'];
  if (fileHint) args.push(fileHint);
  const out = spawnSync('git', args, { cwd: repoPath, encoding: 'utf-8' });
  if (out.status !== 0) return [];
  return out.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function isPilotSpec(specPath) {
  const n = specPath.replace(/\\/g, '/');
  return PILOT_SPECS.some((p) => n.endsWith(p) || n.includes(p));
}

export function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function promptYesNo(question) {
  const readline = await import('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} [y/n] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

export const ALLOWED_EDIT_ROOTS = [
  'tests/',
  'tests/pages/',
  'tests/fixtures/',
  'tests/utils/',
  'tests/helpers/',
];

export const HARD_RULES = [
  'One failure at a time',
  'Edit ai-testing-poc only — never Pm-Doctor-Portal',
  'Never auto-commit, auto-push, or auto-merge',
  'Never weaken assertions without explicit user approval + documented business rule change',
  'Never edit .env or skip tests without approval',
  'Failure count must not increase after heal — rollback on regression',
  'Heal order: blockers → clickResilient → locators → assertions (assertions need approval)',
];

export function parsePatchFilePaths(patchContent) {
  const paths = new Set();
  for (const line of patchContent.split('\n')) {
    const m = line.match(/^\+\+\+ [ab]\/(.*)$/);
    if (m?.[1] && m[1] !== '/dev/null') paths.add(m[1].trim());
  }
  return [...paths];
}

export function backupFiles(relPaths, backupDir) {
  ensureDir(backupDir);
  const manifest = [];
  for (const rel of relPaths) {
    const src = path.join(HEAL_ROOT, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(backupDir, rel);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    manifest.push(rel);
  }
  writeJson(path.join(backupDir, 'manifest.json'), {
    backedUpAt: new Date().toISOString(),
    files: manifest,
  });
  return manifest;
}

export function restoreBackup(backupDir) {
  const manifest = readJson(path.join(backupDir, 'manifest.json'));
  if (!manifest?.files) return [];
  const restored = [];
  for (const rel of manifest.files) {
    const src = path.join(backupDir, rel);
    const dest = path.join(HEAL_ROOT, rel);
    if (!fs.existsSync(src)) continue;
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    restored.push(rel);
  }
  return restored;
}

export async function promptPickFailure(failures) {
  if (failures.length === 0) return null;
  if (failures.length === 1) {
    log(`One hard failure — auto-selected: ${failures[0].specFile}`);
    return failures[0];
  }

  console.log('\nHard failures (pick one to heal):\n');
  failures.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.specFile}`);
    console.log(`     ${f.title}`);
    console.log(`     ${String(f.error).split('\n')[0].slice(0, 100)}...\n`);
  });

  const readline = await import('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`Pick failure [1-${failures.length}]: `, (answer) => {
      rl.close();
      const idx = parseInt(answer.trim(), 10) - 1;
      if (idx >= 0 && idx < failures.length) {
        resolve(failures[idx]);
      } else {
        log('Invalid pick — using first failure.');
        resolve(failures[0]);
      }
    });
  });
}

export const AGENT_PROMPT = `Use skill heal-regression.

Read docs/heal-sessions/current-session.md and test-results/heal/latest/heal-session.json.
Propose a patch for ai-testing-poc only (tests/pages, fixtures, utils, helpers/blockers).
Save unified diff to the session proposed.patch path listed in heal-session.json.
Do not edit Pm-Doctor-Portal. Do not apply the patch — leave changes for npm run test:heal:apply.`;

export function log(msg) {
  console.log(`[heal] ${msg}`);
}
