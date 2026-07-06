import { ai } from '@zerostep/playwright';
import { type Page } from '@playwright/test';
import type { AiContext } from '../utils/zerostep-safe';
import { PRESCRIPTION_TEST_DATA } from '../fixtures/prescription-test-data';
import { AppShellPage } from '../pages/app-shell.page';
import { DashboardPage } from '../pages/dashboard.page';
import { PrescriptionPage } from '../pages/prescription.page';
import { WalkInConsultationPage } from '../pages/walk-in-consultation.page';

/** MoEngage / Talkative — ZeroStep CDP cannot click these reliably. */
function isOverlayOnlyStep(step: string): boolean {
  return /premium|popup|tour|chat widget|dismiss|overlay|blocking widget/i.test(
    step.toLowerCase(),
  );
}

/** Start Walk-in — Playwright anchor (ZeroStep mis-clicks / queue search). */
function isWalkInNavigationStep(step: string): boolean {
  return /start walk-in|open walk-in|walk-in consultation page|walk in consultation page/i.test(
    step.toLowerCase(),
  );
}

function isPatientSearchStep(step: string): boolean {
  const lower = step.toLowerCase();
  return (
    (/9821885020|patient search|search by patient|phone number/i.test(step) ||
      /walk-in consultation page/i.test(lower)) &&
    !/medicat|medicines by name|\bpara\b/i.test(lower)
  );
}

/** Consult row + SmartRx chevron — Playwright anchor (CDP / duplicate phone rows). */
function isConsultFlowStep(step: string): boolean {
  const lower = step.toLowerCase();
  return (
    (/find the row|patient row/i.test(lower) && /abhyuday/i.test(lower)) ||
    (/chevron|smartrx/i.test(lower) && /consult/i.test(lower)) ||
    /wait until the prescription pad/i.test(lower)
  );
}

/** Med autocomplete — Playwright anchor (CDP clickAndInput + Past Visit Data overlap). */
function isMedicationStep(step: string): boolean {
  const lower = step.toLowerCase();
  return (
    (/medicat|medicines by name|\bpara\b/i.test(lower) ||
      /catalog medicine|autocomplete/i.test(lower)) &&
    !/patient search|9821885020|queue/i.test(lower)
  );
}

/** End Visit / Complete — Playwright anchor (ZeroStep misclicks Dose Calculator). */
function isEndVisitStep(step: string): boolean {
  const lower = step.toLowerCase();
  return (
    (/complete|end visit/i.test(lower) && /save|header|prescription/i.test(lower)) ||
    /click complete or end visit/i.test(lower)
  );
}

function isPrintWaitStep(step: string): boolean {
  return /print preview|print page/i.test(step.toLowerCase());
}

function isOnPrescriptionPad(page: Page): boolean {
  return page.url().includes(PRESCRIPTION_TEST_DATA.routes.prescription);
}

function pageContext(page: Page): string {
  const url = page.url();
  if (url.includes('/prescription_print_view')) {
    return 'Context: prescription print preview page. ';
  }
  if (isOnPrescriptionPad(page)) {
    return 'Context: prescription pad. Use Medications (Rx) "Search Medicines by Name" only. ';
  }
  if (url.includes('walk_in_consultation')) {
    return 'Context: Walk-In Consultation page — patient search combobox at top. ';
  }
  return 'Context: dashboard — use Start Walk-in, not queue search. ';
}

async function openWalkInConsultation(page: Page): Promise<void> {
  const dashboard = new DashboardPage(page);
  const walkIn = new WalkInConsultationPage(page);
  await new AppShellPage(page).dismissBlockingOverlays('walk-in-nav');

  if (!page.url().includes(PRESCRIPTION_TEST_DATA.routes.walkIn)) {
    await dashboard.startWalkInConsultation();
  }
  await walkIn.assertOnWalkInPage();
}

async function ensureConsultStarted(page: Page): Promise<void> {
  if (isOnPrescriptionPad(page)) return;

  const walkIn = new WalkInConsultationPage(page);
  const { fullName, mobile, searchQuery } = PRESCRIPTION_TEST_DATA.patient;

  await openWalkInConsultation(page);
  await walkIn.searchPatient(searchQuery);
  await walkIn.assertPatientInResults(fullName, mobile);
  await walkIn.startConsultForPatient(fullName);
  await walkIn.assertNavigatedToPrescription();
}

async function addMedicationOnPad(page: Page): Promise<void> {
  await ensureConsultStarted(page);
  const prescription = new PrescriptionPage(page);
  await prescription.dismissPillUpTourIfPresent();
  await prescription.addMedicationFromSearch(
    PRESCRIPTION_TEST_DATA.medication.searchTerm,
  );
}

async function endVisitOnPad(page: Page): Promise<void> {
  const prescription = new PrescriptionPage(page);
  await prescription.endVisitAndWaitForSave({
    requireMedicine: true,
    minMedicineCount: 1,
  });
}

/**
 * Execute one NL scenario step for `test:ai`.
 *
 * Playwright anchors: overlays, walk-in, consult, medication autocomplete, End Visit.
 * ZeroStep: optional NL steps where CDP is safe (patient search typing if not anchored).
 */
export async function executeScenarioStep(
  step: string,
  page: Page,
  aiCtx: AiContext,
): Promise<void> {
  if (isOverlayOnlyStep(step)) {
    await new AppShellPage(page).dismissBlockingOverlays('ai-overlay');
    return;
  }

  if (isWalkInNavigationStep(step)) {
    await openWalkInConsultation(page);
    return;
  }

  if (isConsultFlowStep(step)) {
    await ensureConsultStarted(page);
    return;
  }

  if (isMedicationStep(step)) {
    await addMedicationOnPad(page);
    return;
  }

  if (isEndVisitStep(step)) {
    await endVisitOnPad(page);
    return;
  }

  if (isPrintWaitStep(step)) {
    await page.waitForURL(/prescription_print_view/, { timeout: 60_000 });
    return;
  }

  if (isPatientSearchStep(step)) {
    await openWalkInConsultation(page);
    if (/9821885020/.test(step)) {
      await new WalkInConsultationPage(page).searchPatient(
        PRESCRIPTION_TEST_DATA.patient.searchQuery,
      );
      return;
    }
  }

  const prompt = `${pageContext(page)}${step}`;

  try {
    await ai(prompt, aiCtx);
  } catch (firstError) {
    await new AppShellPage(page).dismissBlockingOverlays('ai-retry');
    try {
      await ai(`${pageContext(page)}${step}`, aiCtx);
    } catch {
      throw firstError;
    }
  }
}
