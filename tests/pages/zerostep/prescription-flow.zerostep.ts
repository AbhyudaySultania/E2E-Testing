import type { Page } from '@playwright/test';
import { test as playwrightTest } from '@playwright/test';
import { ai } from '@zerostep/playwright';
import { PRESCRIPTION_TEST_DATA } from '../../fixtures/prescription-test-data';
import { RX_TEST_IDS } from '../../fixtures/test-ids';
import { locatorByTestIdOr } from '../../helpers/test-id-locator';
import {
  safeAiAction,
  safeAiQuery,
  type AiContext,
} from '../../utils/zerostep-safe';
import { AppShellPage } from '../app-shell.page';
import { DashboardPage } from '../dashboard.page';
import { WalkInConsultationPage } from '../walk-in-consultation.page';
import { PrescriptionPage, type SelectedMedication } from '../prescription.page';

/**
 * ZeroStep action layer for RX-PAD-E2E-001.
 * Interactions use natural language with Playwright fallbacks when CDP clicks fail.
 * Assertions stay in Playwright page objects.
 *
 * @see docs/zerostep-selector-mapping.md
 */
export class PrescriptionFlowZeroStep {
  private readonly aiCtx: AiContext;
  private readonly appShell: AppShellPage;
  private readonly dashboard: DashboardPage;
  private readonly walkIn: WalkInConsultationPage;
  private readonly prescription: PrescriptionPage;

  constructor(page: Page) {
    this.aiCtx = { page, test: playwrightTest };
    this.appShell = new AppShellPage(page);
    this.dashboard = new DashboardPage(page);
    this.walkIn = new WalkInConsultationPage(page);
    this.prescription = new PrescriptionPage(page);
  }

  /**
   * Deterministic — premium popup close img has no CDP quads; ZeroStep ai() throws here.
   * Replaces: getByRole('button', { name: /do later/i }) + modal/tour dismiss locators
   */
  async dismissBlockingOverlays() {
    await this.appShell.dismissBlockingOverlays();
  }

  /**
   * Playwright only — MoEngage svg[data-name="close-popup"] breaks ZeroStep CDP hover/click.
   * Replaces: getByRole('button', { name: /start walk-in/i }) or goto walk_in
   */
  async startWalkInConsultation() {
    await this.dashboard.startWalkInConsultation();
  }

  /** Replaces: getByPlaceholder(/search by patient.*name.*phone.*id/i) */
  async searchPatient(query: string) {
    const searchResponse = this.aiCtx.page.waitForResponse(
      (res) =>
        res.url().includes(PRESCRIPTION_TEST_DATA.api.searchPatient) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 15_000 },
    );

    const patientSearch = this.aiCtx.page.getByPlaceholder(
      /search by patient.*name.*phone.*id/i,
    );

    await safeAiAction(
      `In the patient search field (Search by patient name, phone, or ID), type "${query}"`,
      this.aiCtx,
      async () => {
        await patientSearch.click();
        await patientSearch.fill(query);
      },
    );
    await searchResponse;
  }

  /**
   * Replaces: .walkincomplete dropdown + Start Consult / Consult / SmartRx / modal fallbacks
   */
  async startConsultForPatient(patientName: string) {
    await safeAiAction(
      `Start a standard consultation (not SmartRx) for patient "${patientName}". If Patient Selected modal shows SmartRx, open the split dropdown chevron and choose Consult.`,
      this.aiCtx,
      () => this.walkIn.startConsultForPatient(patientName),
    );

    if (!this.aiCtx.page.url().includes(PRESCRIPTION_TEST_DATA.routes.prescription)) {
      await this.walkIn.startConsultForPatient(patientName);
    }
  }

  /** Replaces: getByRole('button', { name: /^okay$/i }) PillUp tour */
  async dismissPillUpTourIfPresent() {
    await this.prescription.dismissPillUpTourIfPresent();
  }

  /**
   * Replaces: getByPlaceholder(/search medicines by name/i) + dropdown option locators
   */
  async addMedicationFromSearch(searchTerm: string): Promise<SelectedMedication> {
    const searchResponse = this.aiCtx.page.waitForResponse(
      (res) =>
        res.url().includes(PRESCRIPTION_TEST_DATA.api.searchMedicine) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 15_000 },
    );

    try {
      await ai(
        `In the Medications (Rx) section, click the medicine search field (data-testid="${RX_TEST_IDS.MEDICATION_SEARCH}" or placeholder "Search Medicines by Name") and type "${searchTerm}"`,
        this.aiCtx,
      );
      await searchResponse;
    } catch (err) {
      await searchResponse.catch(() => undefined);
      return this.prescription.addMedicationFromSearch(searchTerm);
    }

    const detailsResponse = this.aiCtx.page.waitForResponse(
      (res) =>
        res.url().includes(PRESCRIPTION_TEST_DATA.api.getMedicineDetails) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 15_000 },
    );

    try {
      await ai(
        'Select the first valid catalog medicine from the autocomplete dropdown. Do not select Add custom medicine or Add new medicine.',
        this.aiCtx,
      );
      await detailsResponse;
    } catch (err) {
      await detailsResponse.catch(() => undefined);
      return this.prescription.addMedicationFromSearch(searchTerm);
    }

    const brandName = await safeAiQuery(
      'What is the tablet/brand name shown in the first medication row of the Medications (Rx) table? Reply with only the brand name, without salt composition.',
      this.aiCtx,
      async () => {
        const med = await this.prescription.addMedicationFromSearch(searchTerm);
        return med.brandName;
      },
    );

    const composition = await safeAiQuery(
      'What is the salt composition text shown in the first medication row (e.g. Paracetamol (300mg) + ...)? Reply with only the composition, or "none" if not visible.',
      this.aiCtx,
      async () => {
        const input = locatorByTestIdOr(
          this.aiCtx.page,
          RX_TEST_IDS.MEDICATION_SEARCH,
          this.aiCtx.page.getByPlaceholder(/search medicines by name/i),
        );
        const row = this.aiCtx.page
          .locator('main')
          .filter({ hasText: /medications?\s*\(rx\)/i })
          .getByText(brandName, { exact: false })
          .first();
        if (!(await row.isVisible({ timeout: 3_000 }).catch(() => false))) {
          return 'none';
        }
        const rowText = await row.evaluate((el) => el.textContent ?? '');
        const withoutBrand = rowText.replace(brandName, '').trim();
        return withoutBrand || 'none';
      },
    );

    return {
      brandName: brandName || searchTerm,
      composition: composition === 'none' ? undefined : composition,
      dropdownLabel:
        composition && composition !== 'none'
          ? `${brandName}, ${composition}`
          : brandName,
    };
  }

  /**
   * Vitals drawer Save — Playwright-first with rx-vitals-save test id.
   * Used when ZeroStep specs extend beyond RX-PAD-E2E-001.
   */
  async clickVitalsDone() {
    const drawer = this.aiCtx.page
      .locator('.ant-drawer-open .search-modalCard')
      .filter({ has: this.aiCtx.page.locator('.modal-title', { hasText: /^patient vitals$/i }) })
      .first();

    const doneButton = drawer
      .getByTestId(RX_TEST_IDS.VITALS_DONE)
      .or(drawer.getByRole('button', { name: /^save$/i }));

    await safeAiAction(
      `In the Vitals drawer, click the Save button (data-testid="${RX_TEST_IDS.VITALS_DONE}").`,
      this.aiCtx,
      async () => {
        await doneButton.click();
      },
    );
  }

  /**
   * Playwright preferred — ZeroStep can misclick Dose Calculator near meds section.
   * Replaces: button.filter({ has: .icon-exit }).filter({ hasText: /end/i })
   */
  async clickEndVisit() {
    await this.prescription.dismissPrescriptionBlockers();

    const endVisit = locatorByTestIdOr(
      this.aiCtx.page,
      RX_TEST_IDS.END_VISIT,
      this.aiCtx.page
        .locator('button')
        .filter({ has: this.aiCtx.page.locator('.icon-exit') })
        .filter({ hasText: /end(\s+visit)?/i }),
    );

    await endVisit.click();
  }
}
