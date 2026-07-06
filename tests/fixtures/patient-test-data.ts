/** Patient for walk-in / all patients / appointment flows — override via .env per doctor JWT */

const DEFAULT_PATIENT = {
  fullName: 'Abhyuday Sultania Updated ws',
  mobile: '9821885020',
  searchQuery: '9821885020',
} as const;

export const PATIENT_TEST_DATA = {
  fullName: process.env.RX_PAD_PATIENT_NAME ?? DEFAULT_PATIENT.fullName,
  mobile: process.env.RX_PAD_PATIENT_MOBILE ?? DEFAULT_PATIENT.mobile,
  searchQuery:
    process.env.RX_PAD_PATIENT_SEARCH ??
    process.env.RX_PAD_PATIENT_MOBILE ??
    DEFAULT_PATIENT.searchQuery,
};
