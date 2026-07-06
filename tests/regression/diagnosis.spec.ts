import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import {
  entryPathTitle,
  finishRegressionVisit,
  setupRegressionSession,
} from '../helpers/regression.harness';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { diagnosisMatchesName } from '../utils/case-manager';
import { skipIfModuleNotVisible } from '../utils/module-guards';

/**
 * RX-PAD-E2E-007 — Diagnosis module (dengue catalog → Dengue hemorrhagic fever)
 * @tags @regression @p1 @prescription @diagnosis
 */
test.describe('RX-PAD-E2E-007: Diagnosis prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add dengue diagnosis → end visit`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const { diagnosis, advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.diagnosis);

      await modules.addDiagnosis(diagnosis.searchTerm);

      const saveContext = await finishRegressionVisit(page, modules, {}, {
        diagnosis: diagnosis.expectedName,
      });

      expect(
        diagnosisMatchesName(saveContext.diagnoses, diagnosis.expectedName),
      ).toBe(true);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        previewAfterEdit: {
          diagnosis: diagnosis.expectedName,
          advice: [advice.editAdd],
        },
        repeatExpectations: {
          diagnosis: diagnosis.expectedName,
          advice: [advice.editAdd],
        },
      });
    });
  }
});
