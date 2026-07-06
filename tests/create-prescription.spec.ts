import { test, expect } from '@playwright/test';
import { AppShellPage } from './pages/app-shell.page';
import { DashboardPage } from './pages/dashboard.page';
import { WalkInConsultationPage } from './pages/walk-in-consultation.page';
import { PrescriptionPage } from './pages/prescription.page';
import { PrescriptionPrintViewPage } from './pages/prescription-print-view.page';
import { PRESCRIPTION_TEST_DATA } from './fixtures/prescription-test-data';
import { installUiBlockerGuard } from './helpers/ui-blocker-guard';
import { captureHealFailureArtifacts } from './heal/capture-on-failure';

/**
 * RX-PAD-E2E-001 — Create and save prescription via Walk-in Consultation
 * @see docs/prescription-test-spec.md
 * @tags @smoke @p0 @prescription @walk-in @uat
 */
test.describe('RX-PAD-E2E-001: Create prescription happy path', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await captureHealFailureArtifacts(page, testInfo);
  });

  test('walk-in consult → add medication → end visit → print view', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const { patient, medication } = PRESCRIPTION_TEST_DATA;

    await installUiBlockerGuard(page);
    const appShell = new AppShellPage(page);
    const dashboard = new DashboardPage(page);
    const walkIn = new WalkInConsultationPage(page);
    const prescription = new PrescriptionPage(page);
    const printView = new PrescriptionPrintViewPage(page);

    // Phase 0 — Session validation
    await dashboard.goto();
    await appShell.assertAuthenticated();
    await appShell.assertMainShellVisible();
    await appShell.dismissBlockingOverlays();
    await dashboard.assertOnDashboard();

    // Phase 1 — Walk-in Consultation
    await appShell.dismissBlockingOverlays();
    await dashboard.startWalkInConsultation();
    await walkIn.assertOnWalkInPage();

    // Phase 2 — Search and start consult
    await walkIn.searchPatient(patient.searchQuery);
    await walkIn.assertPatientInResults(patient.fullName, patient.mobile);
    await walkIn.startConsultForPatient(patient.fullName);
    await walkIn.assertNavigatedToPrescription();

    // Phase 3 — Prescription pad
    await prescription.assertOnPrescriptionPad();
    await prescription.dismissPillUpTourIfPresent();
    await prescription.assertMedicationsSectionVisible();

    // Phase 4 — Add medication
    const selectedMedicine = await prescription.addMedicationFromSearch(
      medication.searchTerm,
    );
    expect(selectedMedicine.brandName.length).toBeGreaterThan(0);
    await prescription.assertMedicationAdded(selectedMedicine);

    // Phase 5 — End Visit (save prescription)
    const saveContext = await prescription.endVisitAndWaitForSave({
      requireMedicine: true,
      minMedicineCount: 1,
    });
    expect(saveContext.tcmId).toBeGreaterThan(0);
    await prescription.assertSaveSuccessToast();

    // Phase 6 — Print view (medication is canvas-rendered PDF — verify via API + canvas)
    await printView.assertOnPrintView();
    await printView.waitForConsultationLoad();
    await printView.assertPatientContextVisible(patient.fullName);
    await printView.assertMedicationSaved(selectedMedicine, saveContext);
    await printView.assertPrintShellVisible();
  });
});
