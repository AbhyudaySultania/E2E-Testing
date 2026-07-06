import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import {
  entryPathTitle,
  finishRegressionVisit,
  setupRegressionSession,
} from '../helpers/regression.harness';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { medicalHistoryContainsCondition } from '../utils/case-manager';
import { skipIfModuleNotVisible } from '../utils/module-guards';

/**
 * RX-PAD-E2E-004 — Medical History: add Asthama under Medical Condition
 * @tags @regression @p1 @prescription @medical-history
 */
test.describe('RX-PAD-E2E-004: Medical history prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add Asthama → end visit`, async ({ page }) => {
      test.setTimeout(120_000);
      const { medicalHistory, advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.medicalHistory);

      await modules.addMedicalCondition(medicalHistory.condition);

      const saveContext = await finishRegressionVisit(page, modules, {}, {
        medicalHistory: medicalHistory.condition,
      });

      expect(
        medicalHistoryContainsCondition(
          saveContext.medicalHistory,
          medicalHistory.condition,
        ),
      ).toBe(true);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        previewAfterEdit: {
          medicalHistory: medicalHistory.condition,
          advice: [advice.editAdd],
        },
        repeatExpectations: {
          medicalHistory: medicalHistory.condition,
          advice: [advice.editAdd],
        },
      });
    });
  }
});
