#!/usr/bin/env node
/**
 * Pre-PR commit check (~3–5 min): auth smoke + full consultation + optional module.
 *
 * Env:
 *   RX_PAD_COMMIT_MODULE=vaccination  → also run tests/regression/vaccination.spec.ts
 *   RX_PAD_ENTRY_PATH=walk-in         → single entry path (see entry-paths.ts)
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const targets = [
  'tests/authenticated-access.spec.ts',
  'tests/regression/full-consultation.spec.ts',
];

const moduleSlug = process.env.RX_PAD_COMMIT_MODULE?.trim();
if (moduleSlug) {
  targets.push(`tests/regression/${moduleSlug}.spec.ts`);
}

const playwrightBin = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'playwright.cmd' : 'playwright',
);

const result = spawnSync(playwrightBin, ['test', ...targets], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
