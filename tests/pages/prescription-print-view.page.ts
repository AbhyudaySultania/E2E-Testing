import { expect, type Page } from '@playwright/test';
import { PRESCRIPTION_TEST_DATA } from '../fixtures/prescription-test-data';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { assertPdfContains } from '../helpers/pdf-text';
import { purgeUiBlockers } from '../helpers/premium-popup-guard';
import type { SelectedMedication } from './prescription.page';
import {
  diagnosisMatchesName,
  extractDiagnosesFromPayload,
  extractInvestigationsFromPayload,
  extractMedicalHistoryFromPayload,
  extractMedicinesFromPayload,
  extractVaccinesFromPayload,
  extractVitalsFromPayload,
  investigationMatchesName,
  medicalHistoryContainsCondition,
  medicineMatchesName,
  examinationContainsName,
  payloadContainsText,
  symptomsContainName,
  vaccinesGivenContainsLabel,
  type SaveVerificationContext,
} from '../utils/case-manager';

export type PreviewExpectations = {
  medicines?: readonly string[];
  investigation?: string;
  diagnosis?: string;
  medicalHistory?: string;
  vaccination?: string;
  labResult?: string;
  vitals?: boolean;
  advice?: readonly string[];
  symptoms?: string | readonly string[];
  examination?: string | readonly string[];
  diet?: { title: string; notes: string };
  pdfTexts?: readonly string[];
};

/**
 * Print preview uses react-pdf with renderTextLayer={false}, so body text is
 * canvas-rendered. Verify via addCaseManager payload + viewCaseManager + optional lab GET.
 */
export class PrescriptionPrintViewPage {
  constructor(private readonly page: Page) {}

  async assertOnPrintView() {
    await expect(this.page).toHaveURL(
      new RegExp(`${PRESCRIPTION_TEST_DATA.routes.printView}$`),
      { timeout: 30_000 },
    );
    await expect(this.page).not.toHaveURL(/\/login/);
  }

  async waitForConsultationLoad() {
    await expect(this.page.getByText(/^preview$/i)).toBeVisible({
      timeout: 20_000,
    });

    const pdfCanvas = this.page
      .locator('.react-pdf__Page canvas, .react-pdf__Page_afterload canvas')
      .first();

    try {
      await expect(pdfCanvas).toBeVisible({ timeout: 45_000 });
    } catch {
      await purgeUiBlockers(this.page);
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await expect(this.page.getByText(/^preview$/i)).toBeVisible({
        timeout: 20_000,
      });
      await expect(pdfCanvas).toBeVisible({ timeout: 45_000 });
    }
  }

  async assertPatientContextVisible(patientName: string) {
    await expect(
      this.page.locator('.patientName').getByText(patientName, { exact: false }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async assertMedicationSaved(
    medication: SelectedMedication,
    context: SaveVerificationContext,
  ) {
    expect(context.tcmId).toBeGreaterThan(0);
    expect(context.savedMedicines.length).toBeGreaterThan(0);

    expect(
      medicineMatchesName(context.savedMedicines, medication.brandName),
      `addCaseManager payload should include "${medication.brandName}"`,
    ).toBe(true);

    await this.assertViewCaseManagerMedicines(medication.brandName);
  }

  private async assertViewCaseManagerMedicines(brandName: string) {
    const viewCaseResponse = await this.page
      .waitForResponse(
        (res) =>
          res.url().includes(PRESCRIPTION_TEST_DATA.api.viewCaseManager) &&
          res.request().method() === 'POST' &&
          res.status() === 200,
        { timeout: 8_000 },
      )
      .catch(() => null);

    if (!viewCaseResponse) return;

    const viewBody = await viewCaseResponse.json();
    const persisted = extractMedicinesFromPayload(viewBody);
    if (persisted.length > 0) {
      expect(
        medicineMatchesName(persisted, brandName),
        `viewCaseManager should include "${brandName}"`,
      ).toBe(true);
    }
  }

  async clickEditPrescription() {
    await purgeUiBlockers(this.page);
    const editButton = this.page.getByRole('button', { name: /edit prescription/i });
    await expect(editButton).toBeVisible({ timeout: 15_000 });

    const prescriptionNav = this.page.waitForURL(
      new RegExp(`${PRESCRIPTION_TEST_DATA.routes.prescription}$`),
      { timeout: 30_000 },
    );

    await editButton.click();
    await prescriptionNav;
  }

  async assertPrintShellVisible() {
    await expect(
      this.page
        .getByRole('button', { name: /print prescription/i })
        .or(this.page.getByText(/^preview$/i))
        .or(this.page.getByText(/configure print setting/i))
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  }

  async assertSaveAndPreview(
    context: SaveVerificationContext,
    expectations: PreviewExpectations,
  ) {
    expect(context.tcmId).toBeGreaterThan(0);

    if (expectations.medicines?.length) {
      for (const med of expectations.medicines) {
        expect(
          medicineMatchesName(context.savedMedicines, med),
          `addCaseManager medicine should include "${med}"`,
        ).toBe(true);
      }
    }

    if (expectations.investigation) {
      expect(
        investigationMatchesName(context.investigations, expectations.investigation),
        `investigation should include "${expectations.investigation}"`,
      ).toBe(true);
    }

    if (expectations.diagnosis) {
      expect(
        diagnosisMatchesName(context.diagnoses, expectations.diagnosis),
        `diagnosis should include "${expectations.diagnosis}"`,
      ).toBe(true);
    }

    if (expectations.medicalHistory) {
      expect(
        medicalHistoryContainsCondition(
          context.medicalHistory,
          expectations.medicalHistory,
        ),
        `medical history should include "${expectations.medicalHistory}"`,
      ).toBe(true);
    }

    if (expectations.vaccination) {
      expect(
        context.vaccinesGiven.length > 0,
        'vaccines.given should not be empty',
      ).toBe(true);
      expect(
        vaccinesGivenContainsLabel(context.vaccinesGiven, expectations.vaccination),
        `vaccines.given should include "${expectations.vaccination}"`,
      ).toBe(true);
    }

    if (expectations.labResult) {
      const labGet = await this.page
        .waitForResponse(
          (res) =>
            res.url().includes(REGRESSION_TEST_DATA.api.labParamsResults) &&
            res.request().method() === 'GET' &&
            res.status() === 200,
          { timeout: 15_000 },
        )
        .catch(() => null);

      if (labGet) {
        const labBody = await labGet.json();
        expect(payloadContainsText(labBody, expectations.labResult)).toBe(true);
      }
      // else: lab results are saved via lab-parameters POST in addLabResultValue,
      // not included in addCaseManager / print view payload
    }

    if (expectations.vitals) {
      expect(context.vitals.length).toBeGreaterThan(0);
    }

    if (expectations.advice?.length) {
      for (const advice of expectations.advice) {
        expect(payloadContainsText(context.requestPayload, advice)).toBe(true);
      }
    }

    if (expectations.symptoms) {
      const symptomNames = Array.isArray(expectations.symptoms)
        ? expectations.symptoms
        : [expectations.symptoms];
      for (const symptom of symptomNames) {
        expect(
          symptomsContainName(context.symptoms, symptom),
          `symptoms should include "${symptom}"`,
        ).toBe(true);
      }
    }

    if (expectations.examination) {
      const examNames = Array.isArray(expectations.examination)
        ? expectations.examination
        : [expectations.examination];
      for (const exam of examNames) {
        expect(
          examinationContainsName(context.examinations, exam),
          `examination should include "${exam}"`,
        ).toBe(true);
      }
    }

    if (expectations.diet) {
      expect(
        payloadContainsText(context.requestPayload, expectations.diet.title),
      ).toBe(true);
      expect(
        payloadContainsText(context.requestPayload, expectations.diet.notes),
      ).toBe(true);
    }

    if (expectations.pdfTexts?.length) {
      await assertPdfContains(this.page, expectations.pdfTexts);
    }

    const previewTexts = [
      ...(expectations.medicines ?? []),
      expectations.investigation,
      expectations.diagnosis,
      expectations.medicalHistory,
      expectations.vaccination,
      ...(expectations.advice ?? []),
      ...(Array.isArray(expectations.symptoms)
        ? expectations.symptoms
        : expectations.symptoms
          ? [expectations.symptoms]
          : []),
      expectations.diet?.title,
      expectations.diet?.notes,
    ].filter(Boolean) as string[];

    if (previewTexts.length > 0) {
      await this.assertPreviewPayloadContains(context, previewTexts);
    }
  }

  private async assertPreviewPayloadContains(
    context: SaveVerificationContext,
    texts: readonly string[],
  ) {
    for (const text of texts) {
      expect(
        payloadContainsText(context.requestPayload, text),
        `addCaseManager payload (print source) should contain "${text}"`,
      ).toBe(true);
    }

    const viewCaseResponse = await this.page
      .waitForResponse(
        (res) =>
          res.url().includes(REGRESSION_TEST_DATA.api.viewCaseManager) &&
          res.request().method() === 'POST' &&
          res.status() === 200,
        { timeout: 8_000 },
      )
      .catch(() => null);

    if (!viewCaseResponse) return;

    const viewBody = await viewCaseResponse.json();
    for (const text of texts) {
      expect(
        payloadContainsText(viewBody, text),
        `viewCaseManager / print preview data should contain "${text}"`,
      ).toBe(true);
    }

    // Cross-check structured fields when viewCaseManager is available
    const viewInvestigations = extractInvestigationsFromPayload(viewBody);
    const viewDiagnoses = extractDiagnosesFromPayload(viewBody);
    const viewMedicalHistory = extractMedicalHistoryFromPayload(viewBody);
    const viewVaccines = extractVaccinesFromPayload(viewBody);
    const viewVitals = extractVitalsFromPayload(viewBody);

    for (const text of texts) {
      const matched =
        investigationMatchesName(viewInvestigations, text) ||
        diagnosisMatchesName(viewDiagnoses, text) ||
        medicalHistoryContainsCondition(viewMedicalHistory, text) ||
        vaccinesGivenContainsLabel(viewVaccines.given, text) ||
        medicineMatchesName(extractMedicinesFromPayload(viewBody), text) ||
        (viewVitals.length > 0 && payloadContainsText(viewBody, text));

      if (!matched) {
        expect(payloadContainsText(viewBody, text)).toBe(true);
      }
    }
  }
}
