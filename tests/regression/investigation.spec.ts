import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import {
  entryPathTitle,
  finishRegressionVisit,
  setupRegressionSession,
} from '../helpers/regression.harness';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { investigationMatchesName } from '../utils/case-manager';
import { skipIfModuleNotVisible } from '../utils/module-guards';

/**
 * RX-PAD-E2E-003 — Investigation module (LAP/NAP Score Test — full string match)
 * @tags @regression @p1 @prescription @investigation
 */
test.describe('RX-PAD-E2E-003: Investigation prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add investigation → end visit`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const { investigation, advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.investigation);

      await modules.addInvestigation(investigation.expectedName, investigation.searchTerm);

      const saveContext = await finishRegressionVisit(page, modules, {}, {
        investigation: investigation.expectedName,
      });

      expect(
        investigationMatchesName(saveContext.investigations, investigation.expectedName),
      ).toBe(true);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        previewAfterEdit: {
          investigation: investigation.expectedName,
          advice: [advice.editAdd],
        },
        repeatExpectations: {
          investigation: investigation.displayLabel,
          advice: [advice.editAdd],
        },
      });
    });
  }
});
