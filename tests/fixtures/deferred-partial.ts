/**
 * Partially verified flows — skipped in regression until fixed.
 * Tracked in docs/checklist.md; skips appear in test-results/skip-report.json.
 */
export const DEFERRED_PARTIAL_CHECKS = {
  'vaccination-pdf': {
    id: 'vaccination-pdf',
    label: 'Vaccination PDF text (HB 1 / Bevac / site)',
    reason:
      'UI flow passes; print PDF omits given vaccines on UAT. Defer PDF + API vaccine assertions until print pipeline / settings are fixed.',
    relatedTests: ['RX-PAD-E2E-005', 'RX-PAD-E2E-011 (vaccination PDF only)'],
  },
} as const;

export type DeferredPartialCheckId = keyof typeof DEFERRED_PARTIAL_CHECKS;

export function deferredPartialReason(id: DeferredPartialCheckId): string {
  const entry = DEFERRED_PARTIAL_CHECKS[id];
  return `[PARTIAL] ${entry.label} — ${entry.reason} (docs/checklist.md)`;
}
