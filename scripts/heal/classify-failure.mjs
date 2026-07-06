import path from 'node:path';
import { PATHS, gitLogSince, writeJson } from './lib.mjs';

/** @typedef {import('./types.ts').HealClassification} HealClassification */

/**
 * @param {number} score
 * @returns {'high' | 'medium' | 'low'}
 */
export function confidenceTier(score) {
  if (score >= 95) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

/**
 * Classify a failure with numeric confidence (V2).
 * @param {{ error?: string; specFile?: string }} failure
 * @param {Record<string, unknown> | null} lastGreen
 * @returns {HealClassification}
 */
export function classifyFailureV2(failure, lastGreen) {
  const err = (failure.error || '').toLowerCase();
  const evidence = [];
  let label = 'bug';
  let confidence = 55;
  let recommendedAction = 'investigate';

  const portalSince = lastGreen?.portal?.commit
    ? gitLogSince(PATHS.portalRepo, lastGreen.portal.commit)
    : [];

  if (portalSince.length > 0) {
    evidence.push(
      `Portal has ${portalSince.length} commit(s) since last green (${String(lastGreen.portal.commit).slice(0, 7)}): ${portalSince.slice(0, 5).join('; ')}`,
    );
  } else if (!lastGreen) {
    evidence.push('No test-results/last-green.json — portal diff unavailable.');
  } else {
    evidence.push('No portal commits since last green baseline.');
  }

  if (/intercept|pointer|blocked|obscured|webpack-dev-server-client-overlay/i.test(err)) {
    evidence.push('Click interception / overlay — blocker registry or clickResilient first.');
    label = 'ui-change';
    confidence = 96;
    recommendedAction = 'heal-test';
  }

  if (/401|403|login|unauthorized|jwt|auth/i.test(err)) {
    label = 'env';
    confidence = 92;
    recommendedAction = 'fix-env';
    evidence.push('Auth/session issue — check RX_PAD_JWT and npm run test:setup.');
  }

  if (
    /locator|strict mode|not found|waiting for|timeout.*exceeded|scrollintoview/i.test(
      failure.error || '',
    ) &&
    label !== 'env'
  ) {
    evidence.push('Failure looks locator/DOM-related.');
    label = portalSince.length > 0 ? 'ui-change' : 'ui-change';
    confidence = Math.max(confidence, portalSince.length > 0 ? 88 : 78);
    recommendedAction = 'heal-test';
  }

  if (/50\d|network|fetch|api|addcasemanager|searchmedicine/i.test(err) && label !== 'env') {
    evidence.push('API/network failure mentioned in error.');
    label = 'bug';
    confidence = Math.min(confidence, 48);
    recommendedAction = 'fix-portal';
  }

  if (
    /medicine|patient|paracetamol|azithral|expect\(|tobe|tohave|pdf/i.test(err) &&
    !/locator|strict mode|waiting for/i.test(err) &&
    label !== 'env'
  ) {
    evidence.push('Business-data / assertion failure (not pure locator).');
    label = 'bug';
    confidence = Math.min(confidence, 42);
    recommendedAction = 'fix-portal';
  }

  if (/iframe|print preview|printview/i.test(err) && label !== 'env') {
    evidence.push('Print preview / iframe assertion failure.');
    label = portalSince.length > 0 ? 'ui-change' : 'bug';
    confidence = label === 'ui-change' ? 82 : 45;
    recommendedAction = label === 'ui-change' ? 'heal-test' : 'fix-portal';
  }

  if (/dropdown|ant-select|section header|frequently used/i.test(err) && label !== 'env') {
    evidence.push('Dropdown structure change suspected.');
    confidence = Math.max(confidence, 84);
    label = 'ui-change';
    recommendedAction = 'heal-test';
  }

  const classification = {
    label,
    confidence,
    confidenceTier: confidenceTier(confidence),
    recommendedAction,
    evidence,
    note: 'Heuristic only — confirm with manual review. Assertions need explicit user approval.',
  };

  writeJson(path.join(PATHS.latestDir, 'classification.json'), classification);
  return classification;
}

/** @deprecated Use classifyFailureV2 — kept for bundle.mjs re-export */
export function classifyFailure(failure, lastGreen) {
  return classifyFailureV2(failure, lastGreen);
}
