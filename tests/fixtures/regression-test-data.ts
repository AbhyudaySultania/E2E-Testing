/** Shared data for RX-PAD regression suite (E2E-002 – E2E-007) */

import { PATIENT_TEST_DATA } from './patient-test-data';

export const REGRESSION_TEST_DATA = {
  patient: PATIENT_TEST_DATA,
  medicines: {
    first: process.env.RX_PAD_MEDICINE_SEARCH ?? 'Para',
    second: process.env.RX_PAD_MEDICINE_SEARCH_2 ?? 'Azithral',
  },
  investigation: {
    searchTerm: 'LAP',
    /** Full catalog string — must match investigation_name in addCaseManager */
    expectedName:
      'Leucocyte Alkaline Phosphatase (LAP) / Neutrophil Alkaline Phosphatase (NAP) Score Test',
    /** Truncated label shown in the prescription row after selection */
    displayLabel: 'Leucocyte Alkaline Phosphatase',
  },
  diagnosis: {
    searchTerm: 'dengue',
    /** Catalog option + API tds_name */
    expectedName: 'Dengue hemorrhagic fever',
    /** Row label after selection (may truncate in UI) */
    displayLabel: 'Dengue hemorrhagic fever',
    /** 0-based index in search results after typing searchTerm */
    catalogOptionIndex: 1,
  },
  medicalHistory: {
    section: 'Medical Condition',
    /** Catalog spelling in UAT (not "Asthma") */
    condition: 'Asthama',
  },
  vaccination: {
    category: 'IAP Vaccines',
    vaccineName: 'HB 1',
    brand: 'Bevac',
    site: 'Left Arm',
  },
  vitals: {
    systolic: '120',
    diastolic: '80',
    pulse: '72',
    weight: '70',
    temperature: '98.6',
    spo2: '98',
    bloodPressureDisplay: '120/80',
  },
  advice: {
    items: ['Rest', 'Plenty of fluids'],
    editAdd: 'Avoid cold drinks',
  },
  diet: {
    moduleName: process.env.RX_PAD_DIET_MODULE_NAME ?? 'Diet',
    title: process.env.RX_PAD_DIET_TITLE ?? 'Protein',
    notes: process.env.RX_PAD_DIET_NOTES ?? '35 gm at least',
  },
  followUp: {
    /** Quick-select chip label to click (must match one of the default 2 Days / 2 Weeks / 2 Months buttons) */
    chipLabel: '2 Weeks',
  },
  symptoms: {
    searchTerm: process.env.RX_PAD_SYMPTOM_SEARCH ?? 'Fever',
  },
  labResults: {
    searchTerm: 'Haemoglobin',
    testValue: '13.5',
  },
  routes: {
    dashboard: '/',
    walkIn: '/walk_in_consultation',
    allPatients: '/all_patients',
    patientDetails: '/patient_details',
    addAppointment: '/add-appointment',
    prescription: '/prescription',
    printView: '/prescription_print_view',
  },
  api: {
    searchPatient: '/api/v1/appointment/searchPatient',
    listDashboardPatients: '/api/v1/patient/listDashboard',
    searchMedicine: '/api/v1/medicine/searchMedicine',
    getMedicineDetails: '/api/v1/medicine/getMedicineDetails',
    searchInvestigation: '/api/v1/investigation/search',
    searchDiagnosis: '/api/v1/diagnosis/search',
    searchMedicalTag: '/api/v1/medicalhistory/searchTag',
    addTag: '/api/v1/medicalhistory/addTag',
    addCaseManager: '/api/v1/casemanager/addCaseManager',
    viewCaseManager: '/api/v1/casemanager/viewCaseManager',
    listSlots: '/api/v1/appointment/listSlots',
    addAppointment: '/api/v1/appointment',
    /** Hosted on pm-patient-docs-uat.tatvacare.in */
    labParamsResults: 'lab-parameters/results',
    labParamsSearch: 'lab-parameters',
    addVitals: '/api/v1/vital/addVitals',
    editCaseManager: '/api/v1/casemanager/editCaseManager',
    searchAdvice: '/api/v1/advice/search',
    frequentlyExaminations: '/api/v1/examination/frequentlyExaminations',
    searchExamination: '/api/v1/examination/search',
    searchSymptom: '/api/v1/symptom/search',
    frequentlySymptoms: '/api/v1/symptom/frequentlySymptoms',
    listConsultations: '/api/v1/casemanager/listConsultations',
  },
  modules: {
    investigation: 'Investigation',
    diagnosis: 'Diagnosis',
    medicalHistory: 'Medical History',
    vaccination: 'Vaccination',
    labResults: 'Lab Results',
    medications: 'Medications',
    vitals: 'Body Metrics & Composition',
    advice: 'Clinical Advices',
    diet: 'Diet',
    followUp: 'Follow-up',
    symptoms: 'Symptoms',
    examination: 'Examinations',
  },
} as const;
