#!/usr/bin/env node
/** @deprecated V2 — use scripts/heal/apply-heal.mjs via npm run test:heal:apply */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'heal/apply-heal.mjs');
const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
process.exit(result.status ?? 1);
