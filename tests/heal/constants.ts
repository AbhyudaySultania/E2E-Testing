/** Pilot specs eligible for heal loop v1. */

export const HEAL_PILOT_SPEC_FILES = [
  'tests/regression/multi-medicine.spec.ts',
  'tests/regression/vitals.spec.ts',
  'tests/create-prescription.spec.ts',
] as const;

export const HEAL_VERIFY_SPEC_FILES = [
  'tests/authenticated-access.spec.ts',
  ...HEAL_PILOT_SPEC_FILES,
] as const;

export const HEAL_REGRESSION_GLOB = 'tests/regression';

export const HEAL_LATEST_DIR = 'test-results/heal/latest';

export const HEAL_LAST_GREEN_PATH = 'test-results/last-green.json';

export const HEAL_SESSIONS_DIR = 'docs/heal-sessions';

export const HEAL_RESULTS_JSON = 'test-results/heal/playwright-results.json';

export const DEFAULT_PORTAL_REPO = '../Pm-Doctor-Portal';

export function isHealPilotSpec(specPath: string): boolean {
  const normalized = specPath.replace(/\\/g, '/');
  return HEAL_PILOT_SPEC_FILES.some(
    (p) => normalized.endsWith(p) || normalized.includes(p),
  );
}
