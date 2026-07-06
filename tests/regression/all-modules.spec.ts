import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { entryPathTitle, setupRegressionSession } from '../helpers/regression.harness';
import { assertPdfContains } from '../helpers/pdf-text';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { PrescriptionPrintViewPage } from '../pages/prescription-print-view.page';
import {
  adviceContainsName,
  diagnosisMatchesName,
  investigationMatchesName,
  medicalHistoryContainsCondition,
  medicineMatchesName,
  symptomsContainName,
  vaccinesGivenContainsLabel,
  vitalsContainValues,
} from '../utils/case-manager';
import { isModuleVisible, skipIfModuleNotVisible } from '../utils/module-guards';
import { vaccinationPdfTexts } from '../utils/vaccination-assert';

/**
 * RX-PAD-E2E-014 — All-modules single-visit regression
 *
 * Every non-custom prescription module is added in one visit, verified in one
 * addCaseManager payload, one PDF, then an Edit + Repeat Rx pass.
 * Modules absent for the doctor account are skipped gracefully without failing
 * the test — only the full-suite guard (medications) hard-skips.
 *
 * Excluded: Diet (custom per-doctor module, guarded by RX_PAD_CUSTOM_DIET).
 */
test.describe('RX-PAD-E2E-014: All-modules single-visit regression', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(
      `${entryPathTitle(entryPath)} → all modules → end visit → repeat Rx`,
      async ({ page }) => {
        test.setTimeout(480_000);

        const {
          medicines,
          investigation,
          diagnosis,
          medicalHistory,
          vitals,
          advice,
          vaccination,
          labResults,
          followUp,
          modules,
        } = REGRESSION_TEST_DATA;

        const { modules: modulesPage } = await setupRegressionSession(page, entryPath);
        const printView = new PrescriptionPrintViewPage(page);

        // ── 1. Medications (required — hard skip if module absent) ────────────
        await skipIfModuleNotVisible(page, modules.medications);
        await modulesPage.addMedicationFromSearch(medicines.first);
        await modulesPage.assertMedicationAdded({ brandName: medicines.first, dropdownLabel: medicines.first });

        // ── 2. Investigation ──────────────────────────────────────────────────
        if (await isModuleVisible(page, modules.investigation)) {
          await modulesPage.addInvestigation(
            investigation.expectedName,
            investigation.searchTerm,
            investigation.displayLabel,
          );
        }

        // ── 3. Diagnosis ──────────────────────────────────────────────────────
        if (await isModuleVisible(page, modules.diagnosis)) {
          await modulesPage.addDiagnosis(diagnosis.searchTerm, diagnosis.expectedName);
        }

        // ── 4. Medical History ────────────────────────────────────────────────
        if (await isModuleVisible(page, modules.medicalHistory)) {
          await modulesPage.addMedicalCondition(medicalHistory.condition);
        }

        // ── 5. Vitals ─────────────────────────────────────────────────────────
        if (await isModuleVisible(page, modules.vitals)) {
          await modulesPage.addVitals(vitals);
          await modulesPage.assertVitalsOnPad(vitals);
        }

        // ── 6. Clinical Advices ───────────────────────────────────────────────
        if (await isModuleVisible(page, modules.advice)) {
          await modulesPage.addAdvices(advice.items);
          await modulesPage.assertAdvicesOnPad(advice.items);
        }

        // ── 7. Vaccination ────────────────────────────────────────────────────
        const vaccinationVisible = await isModuleVisible(page, modules.vaccination);
        if (vaccinationVisible) {
          await modulesPage.giveIapHb1Vaccine(vaccination);
        }

        // ── 8. Lab Results ────────────────────────────────────────────────────
        let savedLabValue: string | null = null;
        if (await isModuleVisible(page, modules.labResults)) {
          savedLabValue = await modulesPage.addLabResultValue(
            labResults.searchTerm,
            labResults.testValue,
          );
        }

        // ── 9. Follow-up ──────────────────────────────────────────────────────
        const followUpVisible = await isModuleVisible(page, modules.followUp);
        if (followUpVisible) {
          await modulesPage.addFollowUpByChip(followUp.chipLabel);
          await modulesPage.assertFollowUpOnPad();
        }

        // ── 10. Symptoms ──────────────────────────────────────────────────────
        let addedSymptomName: string | null = null;
        const symptomsVisible = await isModuleVisible(page, modules.symptoms);
        if (symptomsVisible) {
          addedSymptomName = await modulesPage.addSymptom();
        }

        // ── End Visit ─────────────────────────────────────────────────────────
        const saveContext = await modulesPage.endVisitAndWaitForSave();
        await modulesPage.assertSaveSuccessToast();
        await printView.assertOnPrintView();
        await printView.waitForConsultationLoad();
        await printView.assertPatientContextVisible(REGRESSION_TEST_DATA.patient.fullName);

        // ── API assertions (addCaseManager payload) ───────────────────────────
        expect(saveContext.tcmId, 'tcmId must be positive').toBeGreaterThan(0);

        expect(
          medicineMatchesName(saveContext.savedMedicines, medicines.first),
          `payload must include medicine "${medicines.first}"`,
        ).toBe(true);

        if (saveContext.investigations.length > 0) {
          expect(
            investigationMatchesName(saveContext.investigations, investigation.expectedName),
            `payload must include investigation "${investigation.expectedName}"`,
          ).toBe(true);
        }

        if (saveContext.diagnoses.length > 0) {
          expect(
            diagnosisMatchesName(saveContext.diagnoses, diagnosis.expectedName),
            `payload must include diagnosis "${diagnosis.expectedName}"`,
          ).toBe(true);
        }

        if (saveContext.medicalHistory.length > 0) {
          expect(
            medicalHistoryContainsCondition(saveContext.medicalHistory, medicalHistory.condition),
            `payload must include condition "${medicalHistory.condition}"`,
          ).toBe(true);
        }

        if (saveContext.vitals.length > 0) {
          expect(
            vitalsContainValues(saveContext.vitals, {
              pulse: vitals.pulse,
              weight: vitals.weight,
              temperature: vitals.temperature,
              spo2: vitals.spo2,
              bloodPressure: vitals.bloodPressureDisplay,
            }),
            'payload must include all vitals values',
          ).toBe(true);
        }

        for (const item of advice.items) {
          if (saveContext.advice.length > 0) {
            expect(
              adviceContainsName(saveContext.advice, item),
              `payload must include advice "${item}"`,
            ).toBe(true);
          }
        }

        if (vaccinationVisible && saveContext.vaccinesGiven.length > 0) {
          expect(
            vaccinesGivenContainsLabel(saveContext.vaccinesGiven, vaccination.vaccineName),
            `vaccines.given must include "${vaccination.vaccineName}"`,
          ).toBe(true);
        }

        if (followUpVisible) {
          expect(
            saveContext.requestPayload['follow_up_date'],
            'payload must include non-empty follow_up_date',
          ).toBeTruthy();
        }

        if (addedSymptomName && saveContext.symptoms.length > 0) {
          expect(
            symptomsContainName(saveContext.symptoms, addedSymptomName),
            `payload must include symptom "${addedSymptomName}"`,
          ).toBe(true);
        }

        // ── PDF assertions ────────────────────────────────────────────────────
        const pdfTexts: string[] = [
          medicines.first,
          vitals.bloodPressureDisplay,
          vitals.pulse,
          advice.items[0],
          advice.items[1],
          investigation.displayLabel,
          ...vaccinationPdfTexts(vaccination.vaccineName),
        ];
        await assertPdfContains(page, pdfTexts);

        // ── Edit + Repeat Rx ──────────────────────────────────────────────────
        await runEditAndRepeatRxValidation(page, modulesPage, saveContext.tcmId, {
          editAdvice: advice.editAdd,
          pdfTextsAfterEdit: [
            medicines.first,
            advice.editAdd,
            vitals.pulse,
          ],
          repeatExpectations: {
            medicines: [medicines.first],
            investigation: investigation.displayLabel,
            diagnosis: diagnosis.expectedName,
            medicalHistory: medicalHistory.condition,
            vitals: {
              bloodPressureDisplay: vitals.bloodPressureDisplay,
              pulse: vitals.pulse,
              weight: vitals.weight,
              temperature: vitals.temperature,
              spo2: vitals.spo2,
            },
            advice: [...advice.items, advice.editAdd],
            // Only assert vaccination prefill if it was confirmed in addCaseManager payload.
            // The new Vaccination architecture saves via its own service (not addCaseManager),
            // so vaccinesGiven may be empty even when the vaccination was given.
            ...(vaccinationVisible && saveContext.vaccinesGiven.length > 0
              ? { vaccination: { vaccineName: vaccination.vaccineName, brand: vaccination.brand } }
              : {}),
            ...(savedLabValue ? { labResult: savedLabValue } : {}),
            ...(addedSymptomName ? { symptoms: addedSymptomName } : {}),
          },
        });
      },
    );
  }
});
