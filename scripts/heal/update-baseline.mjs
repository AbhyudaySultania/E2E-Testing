#!/usr/bin/env node
/**
 * Full regression ground truth — writes last-green.json (no CLI reporter override).
 */
import { runPlaywright, log } from './lib.mjs';

log('ground truth: full regression (tests/regression)');

const result = runPlaywright(['test', 'tests/regression'], {
  RX_HEAL_CAPTURE: '0',
  RX_HEAL_BASELINE: '1',
});

if (result.status === 0) {
  log('baseline updated → test-results/last-green.json');
}

process.exit(result.status ?? 1);
