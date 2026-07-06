import type { Page } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import type { EntryPath } from '../fixtures/entry-paths';
import { assertPdfContains } from './pdf-text';
import { setupRegressionSession } from './regression.harness';
import { PatientDetailsConsultationPage } from '../pages/patient-details-consultation.page';
import {
  PrescriptionPrintViewPage,
  type PreviewExpectations,
} from '../pages/prescription-print-view.page';
import type { PrescriptionModulesPage } from '../pages/prescription-modules.page';
import { skipIfModuleNotVisible } from '../utils/module-guards';
import type { EndVisitOptions, SaveVerificationContext } from '../utils/case-manager';

export type EditRepeatRxOptions = {
  editAdvice: string;
  pdfTextsAfterEdit?: readonly string[];
  previewAfterEdit?: PreviewExpectations;
  repeatExpectations: Parameters<PrescriptionModulesPage['assertRepeatRxPrefill']>[0];
  endVisitOptions?: EndVisitOptions;
};

export async function finishModuleVisitWithPdf(
  page: Page,
  modules: PrescriptionModulesPage,
  pdfTexts: readonly string[],
): Promise<SaveVerificationContext> {
  const printView = new PrescriptionPrintViewPage(page);
  const saveContext = await modules.endVisitAndWaitForSave();
  await modules.assertSaveSuccessToast();
  await printView.assertOnPrintView();
  await printView.waitForConsultationLoad();
  await printView.assertPatientContextVisible(REGRESSION_TEST_DATA.patient.fullName);
  await assertPdfContains(page, pdfTexts);
  await printView.assertPrintShellVisible();
  return saveContext;
}

export async function runEditAndRepeatRxValidation(
  page: Page,
  modules: PrescriptionModulesPage,
  tcmId: number,
  options: EditRepeatRxOptions,
) {
  const printView = new PrescriptionPrintViewPage(page);
  const patientDetails = new PatientDetailsConsultationPage(page);

  await printView.clickEditPrescription();
  await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.advice);
  await modules.addAdvices([options.editAdvice]);
  await modules.assertAdvicesOnPad([options.editAdvice]);

  const editSaveContext = await modules.endVisitAndWaitForSave(options.endVisitOptions);
  await modules.assertSaveSuccessToast();
  await printView.assertOnPrintView();
  await printView.waitForConsultationLoad();
  await printView.assertPatientContextVisible(REGRESSION_TEST_DATA.patient.fullName);

  if (options.pdfTextsAfterEdit?.length) {
    await assertPdfContains(page, options.pdfTextsAfterEdit);
  } else if (options.previewAfterEdit) {
    await printView.assertSaveAndPreview(editSaveContext, options.previewAfterEdit);
  }

  await printView.assertPrintShellVisible();

  await patientDetails.openPatientDetails();
  await patientDetails.ensureConsultationByTcmId(tcmId);
  await patientDetails.clickRepeatRx();
  await modules.assertRepeatRxPrefill(options.repeatExpectations);
}

export async function setupModuleSession(page: Page, entryPath: EntryPath) {
  return setupRegressionSession(page, entryPath);
}
