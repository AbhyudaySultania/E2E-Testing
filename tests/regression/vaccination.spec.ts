import { test } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import {
  entryPathTitle,
  finishRegressionVisit,
  setupRegressionSession,
} from '../helpers/regression.harness';
import { skipIfModuleNotVisible } from '../utils/module-guards';
import { vaccinationPdfTexts } from '../utils/vaccination-assert';

/**
 * RX-PAD-E2E-005 — Vaccination: IAP HB 1 with Bevac / Left Arm
 * @tags @regression @p1 @prescription @vaccination
 */
test.describe('RX-PAD-E2E-005: Vaccination prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → IAP HB 1 → end visit`, async ({ page }) => {
      test.setTimeout(120_000);
      const { vaccination } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.vaccination);

      await modules.giveIapHb1Vaccine(vaccination);

      await finishRegressionVisit(page, modules, {}, {
        vaccination: vaccination.vaccineName,
        pdfTexts: vaccinationPdfTexts(vaccination.vaccineName),
      });
    });
  }
});
