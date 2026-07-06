import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import {
  entryPathTitle,
  finishRegressionVisit,
  setupRegressionSession,
} from '../helpers/regression.harness';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { skipIfModuleNotVisible } from '../utils/module-guards';

/**
 * RX-PAD-E2E-006 — Lab Results: add parameter via drawer, assert API save + print
 * @tags @regression @p1 @prescription @lab-results
 */
test.describe('RX-PAD-E2E-006: Lab results prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add lab value → end visit`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const { labResults, advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.labResults);

      const savedValue = await modules.addLabResultValue(
        labResults.searchTerm,
        labResults.testValue,
      );

      const saveContext = await finishRegressionVisit(page, modules, {}, {
        labResult: savedValue,
      });

      // Lab results persist via lab-parameters API (verified in assertSaveAndPreview)
      expect(saveContext.tcmId).toBeGreaterThan(0);
      expect(savedValue).toMatch(/^\d+(\.\d+)?$/);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        previewAfterEdit: {
          labResult: savedValue,
          advice: [advice.editAdd],
        },
        repeatExpectations: {
          // Lab params persist via lab-parameters API; repeat Rx does not mirror them on the pad widget.
          advice: [advice.editAdd],
        },
      });
    });
  }
});
