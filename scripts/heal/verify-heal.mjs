#!/usr/bin/env node
/**
 * Fast heal verification tier (~3–5 min).
 */
import { VERIFY_SPECS, runPlaywright, log } from './lib.mjs';

const extra = process.env.RX_HEAL_FAILED_SPEC?.trim();
const targets = [...VERIFY_SPECS];
if (extra && !targets.includes(extra)) {
  targets.push(extra);
}

log(`verify tier: ${targets.join(', ')}`);

const result = runPlaywright(['test', ...targets, '--reporter=list'], {
  RX_HEAL_CAPTURE: '0',
});

process.exit(result.status ?? 1);
