/** Test data for RX-PAD-E2E-001 — see docs/prescription-test-spec.md */

import { PATIENT_TEST_DATA } from './patient-test-data';

export const PRESCRIPTION_TEST_DATA = {
  patient: PATIENT_TEST_DATA,
  medication: {
    searchTerm: process.env.RX_PAD_MEDICINE_SEARCH ?? 'Para',
  },
  routes: {
    dashboard: '/',
    walkIn: '/walk_in_consultation',
    prescription: '/prescription',
    printView: '/prescription_print_view',
  },
  api: {
    searchPatient: '/api/v1/appointment/searchPatient',
    searchMedicine: '/api/v1/medicine/searchMedicine',
    getMedicineDetails: '/api/v1/medicine/getMedicineDetails',
    addCaseManager: '/api/v1/casemanager/addCaseManager', // response: { status, data: { tcm_id, print_url } }
    viewCaseManager: '/api/v1/casemanager/viewCaseManager',
  },
  messages: {
    visitEnded: /visit ended successfully/i,
    fillMedication: /please fillup medication name/i,
  },
} as const;
