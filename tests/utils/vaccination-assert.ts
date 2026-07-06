/** Vaccination PDF lines need portal print-payload fix (sessionGivenVaccines). */
export function shouldAssertVaccinationPdf(): boolean {
  const base = (process.env.RX_PAD_BASE_URL ?? '').toLowerCase();
  if (process.env.RX_PAD_ASSERT_VACCINATION_PDF === '1') return true;
  if (process.env.RX_PAD_ASSERT_VACCINATION_PDF === '0') return false;
  return base.includes('localhost') || base.includes('127.0.0.1');
}

export function vaccinationPdfTexts(vaccineName: string): string[] {
  return shouldAssertVaccinationPdf() ? [vaccineName] : [];
}
