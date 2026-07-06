import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { entryPathTitle, setupRegressionSession } from '../helpers/regression.harness';
import {
  finishModuleVisitWithPdf,
  runEditAndRepeatRxValidation,
} from '../helpers/module-regression.harness';
import { skipIfModuleNotVisible } from '../utils/module-guards';

/**
 * RX-PAD-E2E-012 — Follow-up scheduling
 *
 * Flow: select a quick-chip (2 Weeks) → assert date shows on pad →
 * end visit → assert follow_up_date in addCaseManager payload → edit + repeat Rx.
 *
 * Follow-up date does not pre-fill on Repeat Rx (per-visit field).
 */
test.describe('RX-PAD-E2E-012: Follow-up scheduling', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → set follow-up → end visit`, async ({ page }) => {
      test.setTimeout(120_000);
      const { followUp, advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.followUp, {
        scrollToBottom: true,
      });

      await modules.addFollowUpByChip(followUp.chipLabel);
      await modules.assertFollowUpOnPad();

      // PDF text assertion skipped — follow-up date is dynamic (computed at runtime).
      // API assertion below is the primary verification.
      const saveContext = await finishModuleVisitWithPdf(page, modules, []);

      expect(
        saveContext.requestPayload['follow_up_date'],
        'addCaseManager payload must include a non-empty follow_up_date',
      ).toBeTruthy();

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        pdfTextsAfterEdit: [advice.editAdd],
        repeatExpectations: {
          advice: [advice.editAdd],
          // follow-up date intentionally omitted — it is a per-visit field, not pre-filled on Repeat Rx
        },
      });
    });
  }
});
