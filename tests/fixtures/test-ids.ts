/**
 * Mirror of Pm-Doctor-Portal/src/utils/e2eTestIds.js — keep in sync.
 */
export const RX_TEST_IDS = {
  END_VISIT: 'rx-end-visit',
  CONSULT_PRIMARY: 'rx-consult-primary',
  CONSULT_MENU: 'rx-consult-menu',
  CONSULT_SPLIT: 'rx-consult-split',
  WALK_IN_START_CONSULT: 'rx-walk-in-start-consult',
  QUEUE_CONSULT: 'rx-queue-consult',
  PATIENT_DETAILS_CONSULT: 'rx-patient-details-consult',
  MEDICATION_SEARCH: 'rx-medication-search',
  VITALS_DONE: 'rx-vitals-save',
  MODULE_VITALS: 'rx-module-body-metrics',
  MODULE_VITALS_ENTRY: 'rx-module-vitals-entry',
  MODULE_MEDICAL_HISTORY: 'rx-module-medical-history',
  MODULE_MEDICAL_HISTORY_ENTRY: 'rx-module-medical-history-entry',
  MODULE_VACCINATION: 'rx-module-vaccination',
  MODULE_VACCINATION_ADD: 'rx-module-vaccination-add',
  MODULE_LAB_RESULTS: 'rx-module-lab-results',
  MODULE_LAB_RESULTS_ENTRY: 'rx-module-lab-results-entry',
  MODULE_DIAGNOSIS: 'rx-module-diagnosis',
  MODULE_MEDICATIONS: 'rx-module-medications',
  MODULE_ADVICE: 'rx-module-advice',
  MODULE_INVESTIGATION: 'rx-module-investigation',
  MODULE_DIET: 'rx-module-diet',
  MODULE_FOLLOW_UP: 'rx-module-follow-up',
  MODULE_SYMPTOMS: 'rx-module-symptoms',
  MODULE_SYMPTOMS_SEARCH: 'rx-module-symptoms-search',
  MODULE_EXAMINATION: 'rx-module-examination',
} as const;

export type RxTestId = (typeof RX_TEST_IDS)[keyof typeof RX_TEST_IDS];

/** Regression module title → stable box test id */
export const RX_MODULE_BOX_BY_TITLE: Record<string, RxTestId> = {
  Investigation: RX_TEST_IDS.MODULE_INVESTIGATION,
  Diagnosis: RX_TEST_IDS.MODULE_DIAGNOSIS,
  'Medical History': RX_TEST_IDS.MODULE_MEDICAL_HISTORY,
  Vaccination: RX_TEST_IDS.MODULE_VACCINATION,
  'Lab Results': RX_TEST_IDS.MODULE_LAB_RESULTS,
  Medications: RX_TEST_IDS.MODULE_MEDICATIONS,
  'Body Metrics & Composition': RX_TEST_IDS.MODULE_VITALS,
  'Clinical Advices': RX_TEST_IDS.MODULE_ADVICE,
  Advices: RX_TEST_IDS.MODULE_ADVICE,
  Diet: RX_TEST_IDS.MODULE_DIET,
  'Follow-up': RX_TEST_IDS.MODULE_FOLLOW_UP,
  Symptoms: RX_TEST_IDS.MODULE_SYMPTOMS,
  Examinations: RX_TEST_IDS.MODULE_EXAMINATION,
};

export function rxModuleBoxId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug ? `rx-module-${slug}` : 'rx-module-unknown';
}
