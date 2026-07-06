import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { entryPathTitle, finishRegressionVisit, setupRegressionSession } from '../helpers/regression.harness';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { examinationContainsName } from '../utils/case-manager';
import { skipIfModuleNotVisible } from '../utils/module-guards';

/**
 * RX-PAD-E2E-015 — Examinations module
 *
 * Flow: click "Search Examinations" → pick first frequently-used catalog item →
 * assert on pad → end visit → assert examination_name in addCaseManager payload →
 * edit + repeat Rx validation.
 *
 * Examination name is captured at runtime from the catalog (no hardcoded string)
 * so the test is robust across different doctor accounts and catalog states.
 */
test.describe('RX-PAD-E2E-015: Examination prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add examination → end visit`, async ({ page }) => {
      test.setTimeout(120_000);
      const { advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.examination);

      const examinationName = await modules.addExamination();

      const saveContext = await finishRegressionVisit(page, modules, {}, {
        examination: examinationName,
      });

      expect(
        examinationContainsName(saveContext.examinations, examinationName),
        `addCaseManager payload must include examination "${examinationName}"`,
      ).toBe(true);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        previewAfterEdit: {
          examination: examinationName,
          advice: [advice.editAdd],
        },
        repeatExpectations: {
          examination: examinationName,
          advice: [advice.editAdd],
        },
      });
    });
  }
});
