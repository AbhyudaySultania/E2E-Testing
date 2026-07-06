import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { entryPathTitle, setupRegressionSession } from '../helpers/regression.harness';
import {
  finishModuleVisitWithPdf,
  runEditAndRepeatRxValidation,
} from '../helpers/module-regression.harness';
import { skipIfModuleNotVisible } from '../utils/module-guards';
import { moduleContentsContainDiet } from '../utils/case-manager';

/**
 * RX-PAD-CUSTOM-001 — Doctor-specific custom "Diet" module.
 * Not part of the standard regression gate (npm run test:regression).
 * Run explicitly: npm run test:custom:diet
 * Requires the custom Diet module on the doctor account configured in .env.
 */
test.describe('RX-PAD-CUSTOM-001: Diet custom module @custom @doctor-setup', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add Diet → end visit`, async ({ page }) => {
      test.setTimeout(120_000);
      const { diet, advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, diet.moduleName, { scrollToBottom: true });

      await modules.addDietEntry(diet.title, diet.notes);
      await modules.assertDietOnPad(diet.title, diet.notes);

      const saveContext = await finishModuleVisitWithPdf(page, modules, [
        diet.title,
        diet.notes,
      ]);

      expect(
        moduleContentsContainDiet(
          saveContext.moduleContents,
          diet.moduleName,
          diet.title,
          diet.notes,
        ),
      ).toBe(true);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        pdfTextsAfterEdit: [diet.title, diet.notes, advice.editAdd],
        repeatExpectations: {
          diet: { title: diet.title, notes: diet.notes },
          advice: [advice.editAdd],
        },
      });
    });
  }
});
