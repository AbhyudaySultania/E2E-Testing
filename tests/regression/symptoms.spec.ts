import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import {
  entryPathTitle,
  finishRegressionVisit,
  setupRegressionSession,
} from '../helpers/regression.harness';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { symptomsContainName } from '../utils/case-manager';
import { skipIfModuleNotVisible } from '../utils/module-guards';

/**
 * RX-PAD-E2E-013 — Symptoms: pick first frequently-used catalog symptom
 * @tags @regression @p1 @prescription @symptoms
 */
test.describe('RX-PAD-E2E-013: Symptoms prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add symptom → end visit`, async ({ page }) => {
      test.setTimeout(120_000);
      const { advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.symptoms);

      const symptomName = await modules.addSymptom();

      const saveContext = await finishRegressionVisit(page, modules, {}, {
        symptoms: symptomName,
      });

      expect(symptomsContainName(saveContext.symptoms, symptomName)).toBe(true);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        previewAfterEdit: {
          symptoms: symptomName,
          advice: [advice.editAdd],
        },
        repeatExpectations: {
          symptoms: symptomName,
          advice: [advice.editAdd],
        },
      });
    });
  }
});
