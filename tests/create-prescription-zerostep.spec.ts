import { test, expect } from '@playwright/test';
import { AppShellPage } from './pages/app-shell.page';
import { DashboardPage } from './pages/dashboard.page';
import { WalkInConsultationPage } from './pages/walk-in-consultation.page';
import { PrescriptionPage } from './pages/prescription.page';
import { PrescriptionPrintViewPage } from './pages/prescription-print-view.page';
import { PrescriptionFlowZeroStep } from './pages/zerostep/prescription-flow.zerostep';
import { PRESCRIPTION_TEST_DATA } from './fixtures/prescription-test-data';

/**
 * RX-PAD-E2E-001 — ZeroStep hybrid variant
 *
 * - Actions: ZeroStep ai() (natural language, runtime element resolution)
 * - Assertions: Playwright page objects (deterministic — unchanged from create-prescription.spec.ts)
 *
 * Requires ZEROSTEP_TOKEN in .env — https://zerostep.com
 *
 * @tags @zerostep @smoke @p0 @prescription @walk-in @uat
 * @see docs/zerostep-selector-mapping.md
 */
test.describe('RX-PAD-E2E-001: Create prescription (ZeroStep hybrid)', () => {
  test('walk-in consult → add medication → end visit → print view', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    if (!process.env.ZEROSTEP_TOKEN?.trim()) {
      test.skip(
        true,
        'ZEROSTEP_TOKEN is required. Add it to .env — see .env.example',
      );
    }

    const { patient, medication } = PRESCRIPTION_TEST_DATA;

    const appShell = new AppShellPage(page);
    const dashboard = new DashboardPage(page);
    const walkIn = new WalkInConsultationPage(page);
    const prescription = new PrescriptionPage(page);
    const printView = new PrescriptionPrintViewPage(page);
    const zs = new PrescriptionFlowZeroStep(page);

    // Phase 0 — Session validation (deterministic assertions)
    await dashboard.goto();
    await appShell.assertAuthenticated();
    await appShell.assertMainShellVisible();
    await zs.dismissBlockingOverlays();
    await dashboard.assertOnDashboard();

    // Phase 1 — Walk-in Consultation (AI action + deterministic assertions)
    await zs.dismissBlockingOverlays();
    await zs.startWalkInConsultation();
    await walkIn.assertOnWalkInPage();

    // Phase 2 — Search and start consult (AI actions + deterministic assertions)
    await zs.searchPatient(patient.searchQuery);
    await walkIn.assertPatientInResults(patient.fullName, patient.mobile);
    await zs.startConsultForPatient(patient.fullName);
    await walkIn.assertNavigatedToPrescription();

    // Phase 3 — Prescription pad (AI dismiss + deterministic assertions)
    await prescription.assertOnPrescriptionPad();
    await zs.dismissPillUpTourIfPresent();
    await prescription.assertMedicationsSectionVisible();

    // Phase 4 — Add medication (AI action + deterministic assertions)
    const selectedMedicine = await zs.addMedicationFromSearch(
      medication.searchTerm,
    );
    expect(selectedMedicine.brandName.length).toBeGreaterThan(0);
    await prescription.assertMedicationAdded(selectedMedicine);

    // Phase 5 — End Visit (AI click + API/navigation assertions — unchanged)
    const saveContext = await prescription.endVisitAndWaitForSave(
      { requireMedicine: true, minMedicineCount: 1 },
      () => zs.clickEndVisit(),
    );
    expect(saveContext.tcmId).toBeGreaterThan(0);
    await prescription.assertSaveSuccessToast();

    // Phase 6 — Print view (deterministic assertions — canvas/API, not AI)
    await printView.assertOnPrintView();
    await printView.waitForConsultationLoad();
    await printView.assertPatientContextVisible(patient.fullName);
    await printView.assertMedicationSaved(selectedMedicine, saveContext);
    await printView.assertPrintShellVisible();
  });
});
