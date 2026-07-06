#!/usr/bin/env node
/**
 * Notify developer / Cursor Agent that a heal session is ready.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, AGENT_PROMPT, log } from './lib.mjs';

const sessionPath = path.join(PATHS.latestDir, 'heal-session.json');
const currentMd = path.join(PATHS.sessionsDir, 'current-session.md');

if (!fs.existsSync(sessionPath)) {
  console.error('[heal] notify: heal-session.json missing');
  process.exit(1);
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  HEAL V2 — Cursor Agent context ready                    ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');
log(`Session:  ${sessionPath}`);
log(`Context:  ${currentMd}`);
console.log('\n--- Paste into Cursor Agent chat (or use heal-regression skill) ---\n');
console.log(AGENT_PROMPT);
console.log('\n--- After Agent writes proposed.patch, run: ---\n');
console.log('  npm run test:heal:apply\n');
