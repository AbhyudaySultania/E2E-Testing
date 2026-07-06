import { test, expect } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { assertPdfContains } from '../helpers/pdf-text';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { setupRegressionSession } from '../helpers/regression.harness';
import { PrescriptionPrintViewPage } from '../pages/prescription-print-view.page';
import {
  adviceContainsName,
  moduleContentsContainDiet,
  vaccinesGivenContainsLabel,
  vitalsContainValues,
} from '../utils/case-manager';
import { isCustomDietEnabled } from '../utils/custom-tests';
import { skipIfModuleNotVisible } from '../utils/module-guards';
import { shouldAssertVaccinationPdf } from '../utils/vaccination-assert';

/**
 * RX-PAD-E2E-011 — Full walk-in consultation with persistence (edit + repeat Rx)
 * Diet steps run only when RX_PAD_CUSTOM_DIET=1 (doctor has custom Diet module).
 */
test.describe('RX-PAD-E2E-011: Full consultation persistence', () => {
  test('Walk-in → vitals + advice + HB 1 → edit → repeat Rx', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const { vitals, advice, diet, vaccination, patient } = REGRESSION_TEST_DATA;
    const includeDiet = isCustomDietEnabled();
    const { modules } = await setupRegressionSession(page, 'walk-in');
    const printView = new PrescriptionPrintViewPage(page);

    await modules.addVitals(vitals);
    await modules.assertVitalsOnPad(vitals);

    await modules.addAdvices(advice.items);
    await modules.assertAdvicesOnPad(advice.items);

    if (includeDiet) {
      await skipIfModuleNotVisible(page, diet.moduleName, { scrollToBottom: true });
      await modules.addDietEntry(diet.title, diet.notes);
      await modules.assertDietOnPad(diet.title, diet.notes);
    }

    // IAP HB 1 flow with API + PDF verification after End Visit.
    await modules.giveIapHb1Vaccine(vaccination);

    const saveContext = await modules.endVisitAndWaitForSave();
    await modules.assertSaveSuccessToast();
    await printView.assertOnPrintView();
    await printView.waitForConsultationLoad();
    await printView.assertPatientContextVisible(patient.fullName);

    const pdfTexts = [
      vitals.bloodPressureDisplay,
      vitals.pulse,
      advice.items[0],
      advice.items[1],
      ...(includeDiet ? [diet.title, diet.notes] : []),
      ...(shouldAssertVaccinationPdf() ? [vaccination.vaccineName] : []),
    ];
    await assertPdfContains(page, pdfTexts);

    expect(
      vitalsContainValues(saveContext.vitals, {
        pulse: vitals.pulse,
        weight: vitals.weight,
        temperature: vitals.temperature,
        spo2: vitals.spo2,
        bloodPressure: vitals.bloodPressureDisplay,
      }),
    ).toBe(true);
    for (const item of advice.items) {
      expect(adviceContainsName(saveContext.advice, item)).toBe(true);
    }
    if (includeDiet) {
      expect(
        moduleContentsContainDiet(
          saveContext.moduleContents,
          diet.moduleName,
          diet.title,
          diet.notes,
        ),
      ).toBe(true);
    }
    expect(
      vaccinesGivenContainsLabel(saveContext.vaccinesGiven, vaccination.vaccineName),
      `vaccines.given should include "${vaccination.vaccineName}"`,
    ).toBe(true);

    await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
      editAdvice: advice.editAdd,
      pdfTextsAfterEdit: [
        vitals.pulse,
        advice.editAdd,
        ...(includeDiet ? [diet.notes] : []),
      ],
      repeatExpectations: {
        advice: [...advice.items, advice.editAdd],
        ...(includeDiet ? { diet: { title: diet.title, notes: diet.notes } } : {}),
      },
    });
  });
});
