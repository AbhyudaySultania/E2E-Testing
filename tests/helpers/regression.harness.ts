import type { Page } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import type { EntryPath } from '../fixtures/entry-paths';
import { ENTRY_PATH_LABELS } from '../fixtures/entry-paths';
import { navigateToPrescriptionPad } from './navigate-to-prescription';
import { installUiBlockerGuard } from './ui-blocker-guard';
import { AppShellPage } from '../pages/app-shell.page';
import { PrescriptionModulesPage } from '../pages/prescription-modules.page';
import {
  PrescriptionPrintViewPage,
  type PreviewExpectations,
} from '../pages/prescription-print-view.page';
import type { SaveVerificationContext } from '../utils/case-manager';
import type { EndVisitOptions } from '../utils/case-manager';

export async function setupRegressionSession(page: Page, entryPath: EntryPath) {
  await installUiBlockerGuard(page);
  const appShell = new AppShellPage(page);
  await appShell.dismissBlockingOverlays();
  const prescription = await navigateToPrescriptionPad(page, entryPath);
  await appShell.dismissBlockingOverlays();
  const modules = new PrescriptionModulesPage(page);
  return { prescription, modules, appShell };
}

export async function finishRegressionVisit(
  page: Page,
  prescription: PrescriptionModulesPage,
  endVisitOptions: EndVisitOptions,
  preview: PreviewExpectations,
): Promise<SaveVerificationContext> {
  const appShell = new AppShellPage(page);
  const printView = new PrescriptionPrintViewPage(page);
  await appShell.dismissPremiumPopup();
  const saveContext = await prescription.endVisitAndWaitForSave(endVisitOptions);
  await prescription.assertSaveSuccessToast();

  await printView.assertOnPrintView();
  await printView.waitForConsultationLoad();
  await printView.assertPatientContextVisible(REGRESSION_TEST_DATA.patient.fullName);
  await printView.assertSaveAndPreview(saveContext, preview);
  await printView.assertPrintShellVisible();

  return saveContext;
}

export function entryPathTitle(entryPath: EntryPath): string {
  return ENTRY_PATH_LABELS[entryPath];
}
