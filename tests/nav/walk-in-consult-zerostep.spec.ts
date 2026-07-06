import { test, expect } from '@playwright/test';
import { AppShellPage } from '../pages/app-shell.page';
import { DashboardPage } from '../pages/dashboard.page';
import { WalkInConsultationPage } from '../pages/walk-in-consultation.page';
import { PrescriptionPage } from '../pages/prescription.page';
import { PrescriptionFlowZeroStep } from '../pages/zerostep/prescription-flow.zerostep';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';

/**
 * ZeroStep is used only for navigation + walk-in consult entry (not module tests).
 * @tags @zerostep @nav @walk-in @uat
 */
test.describe('NAV: Walk-in consult via ZeroStep', () => {
  test('dashboard → walk-in → search → consult → prescription pad', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    if (!process.env.ZEROSTEP_TOKEN?.trim()) {
      test.skip(true, 'ZEROSTEP_TOKEN is required. Add it to .env');
    }

    const { patient } = REGRESSION_TEST_DATA;
    const appShell = new AppShellPage(page);
    const dashboard = new DashboardPage(page);
    const walkIn = new WalkInConsultationPage(page);
    const prescription = new PrescriptionPage(page);
    const zs = new PrescriptionFlowZeroStep(page);

    await dashboard.goto();
    await appShell.assertAuthenticated();
    await zs.dismissBlockingOverlays();

    await zs.startWalkInConsultation();
    await walkIn.assertOnWalkInPage();

    await zs.searchPatient(patient.searchQuery);
    await walkIn.assertPatientInResults(patient.fullName, patient.mobile);
    await zs.startConsultForPatient(patient.fullName);
    await walkIn.assertNavigatedToPrescription();

    await prescription.assertOnPrescriptionPad();
    await zs.dismissPillUpTourIfPresent();
    await expect(page).toHaveURL(new RegExp(`${REGRESSION_TEST_DATA.routes.prescription}$`));
  });
});
