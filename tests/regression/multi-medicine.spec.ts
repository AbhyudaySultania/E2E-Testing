import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import {
  entryPathTitle,
  finishRegressionVisit,
  setupRegressionSession,
} from '../helpers/regression.harness';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { medicineMatchesName } from '../utils/case-manager';
import { captureHealFailureArtifacts } from '../heal/capture-on-failure';

/**
 * RX-PAD-E2E-002 — Multi-medicine prescription (Para + Azithral)
 * @tags @regression @p1 @prescription @medications
 */
test.describe('RX-PAD-E2E-002: Multi-medicine prescription', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await captureHealFailureArtifacts(page, testInfo);
  });

  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → Para + Azithral → end visit`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const { medicines, advice } = REGRESSION_TEST_DATA;

      const { prescription, modules } = await setupRegressionSession(page, entryPath);
      await prescription.assertMedicationsSectionVisible();

      const para = await prescription.addMedicationFromSearch(medicines.first);
      await prescription.assertMedicationAdded(para);

      const azithral = await modules.addSecondMedication(medicines.second);
      await prescription.assertMedicationAdded(azithral);

      const saveContext = await finishRegressionVisit(
        page,
        modules,
        { requireMedicine: true, minMedicineCount: 2 },
        { medicines: [para.brandName, azithral.brandName] },
      );

      expect(medicineMatchesName(saveContext.savedMedicines, medicines.first)).toBe(
        true,
      );
      expect(medicineMatchesName(saveContext.savedMedicines, medicines.second)).toBe(
        true,
      );

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        previewAfterEdit: {
          medicines: [para.brandName, azithral.brandName],
          advice: [advice.editAdd],
        },
        repeatExpectations: {
          medicines: [para.brandName, azithral.brandName],
          advice: [advice.editAdd],
        },
        endVisitOptions: { requireMedicine: true, minMedicineCount: 2 },
      });
    });
  }
});
