import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { entryPathTitle, setupRegressionSession } from '../helpers/regression.harness';
import {
  finishModuleVisitWithPdf,
  runEditAndRepeatRxValidation,
} from '../helpers/module-regression.harness';
import { skipIfModuleNotVisible } from '../utils/module-guards';
import { adviceContainsName } from '../utils/case-manager';

/**
 * RX-PAD-E2E-009 — Classic advice box
 */
test.describe('RX-PAD-E2E-009: Advice prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add advice → end visit`, async ({ page }) => {
      test.setTimeout(120_000);
      const { advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.advice);

      await modules.addAdvices(advice.items);
      await modules.assertAdvicesOnPad(advice.items);

      const saveContext = await finishModuleVisitWithPdf(page, modules, advice.items);

      for (const item of advice.items) {
        expect(adviceContainsName(saveContext.advice, item)).toBe(true);
      }

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        pdfTextsAfterEdit: [...advice.items, advice.editAdd],
        repeatExpectations: {
          advice: [...advice.items, advice.editAdd],
        },
      });
    });
  }
});
