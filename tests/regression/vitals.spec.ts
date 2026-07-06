import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { entryPathTitle, setupRegressionSession } from '../helpers/regression.harness';
import {
  finishModuleVisitWithPdf,
  runEditAndRepeatRxValidation,
} from '../helpers/module-regression.harness';
import { skipIfModuleNotVisible } from '../utils/module-guards';
import { vitalsContainValues } from '../utils/case-manager';
import { captureHealFailureArtifacts } from '../heal/capture-on-failure';

/**
 * RX-PAD-E2E-008 — Vitals on prescription pad
 */
test.describe('RX-PAD-E2E-008: Vitals prescription', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await captureHealFailureArtifacts(page, testInfo);
  });

  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add vitals → end visit`, async ({ page }) => {
      test.setTimeout(120_000);
      const { vitals, advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.vitals);

      await modules.addVitals(vitals);
      await modules.assertVitalsOnPad(vitals);

      const saveContext = await finishModuleVisitWithPdf(page, modules, [
        vitals.bloodPressureDisplay,
        vitals.pulse,
        vitals.weight,
        vitals.temperature,
        vitals.spo2,
      ]);

      expect(
        vitalsContainValues(saveContext.vitals, {
          pulse: vitals.pulse,
          weight: vitals.weight,
          temperature: vitals.temperature,
          spo2: vitals.spo2,
          bloodPressure: vitals.bloodPressureDisplay,
        }),
      ).toBe(true);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        pdfTextsAfterEdit: [vitals.pulse, advice.editAdd],
        repeatExpectations: {
          vitals,
          advice: [advice.editAdd],
        },
      });
    });
  }
});
