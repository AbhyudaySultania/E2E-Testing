import { expect, type Page } from '@playwright/test';
import { PRESCRIPTION_TEST_DATA } from '../fixtures/prescription-test-data';
import { RX_TEST_IDS } from '../fixtures/test-ids';
import { locatorByTestIdOr, moduleBoxByTitle } from '../helpers/test-id-locator';
import {
  clickFirstResilient,
  dismissPrescriptionBlockers as dismissRxBlockers,
  dismissKnownBlockers,
} from '../helpers/ui-blocker-guard';
import { AppShellPage } from './app-shell.page';
import {
  buildSaveVerificationContext,
  type EndVisitOptions,
  type SaveVerificationContext,
} from '../utils/case-manager';
import { collapsePastVisitDataIfExpanded } from '../utils/module-guards';

export type SelectedMedication = {
  /** Brand/tablet name shown in the prescription row */
  brandName: string;
  /** Salt composition when present in dropdown label */
  composition?: string;
  /** Raw first line from autocomplete option */
  dropdownLabel: string;
};

function isSuccessfulCaseManagerResponse(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;

  const status = (body as Record<string, unknown>).status;
  return (
    status === true ||
    status === 1 ||
    status === 'true' ||
    status === 'success'
  );
}

function parseMedicineDropdownText(raw: string): SelectedMedication {
  const dropdownLabel = raw.split('\n')[0].trim();
  const commaIndex = dropdownLabel.indexOf(',');
  if (commaIndex === -1) {
    return { brandName: dropdownLabel, dropdownLabel };
  }

  return {
    brandName: dropdownLabel.slice(0, commaIndex).trim(),
    composition: dropdownLabel.slice(commaIndex + 1).trim(),
    dropdownLabel,
  };
}

export class PrescriptionPage {
  protected readonly appShell: AppShellPage;

  constructor(protected readonly page: Page) {
    this.appShell = new AppShellPage(page);
  }

  private visibleAutocompleteDropdown(classHint: string) {
    return this.page
      .locator(
        `${classHint}:not(.ant-select-dropdown-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden)`,
      )
      .last();
  }

  private async ensureAutocompleteOpen(searchInput: ReturnType<Page['getByPlaceholder']>) {
    const dropdown = this.visibleAutocompleteDropdown(
      '.medicine-parent-autocomplete-dropdown',
    );
    if (await dropdown.isVisible({ timeout: 1_000 }).catch(() => false)) {
      return dropdown;
    }
    await searchInput.click();
    await this.page.keyboard.press('ArrowDown');
    await expect(dropdown).toBeVisible({ timeout: 10_000 });
    return dropdown;
  }

  private get endVisitButton() {
    const fallback = this.page
      .locator('button')
      .filter({ has: this.page.locator('.icon-exit') })
      .filter({ hasText: /end(\s+visit)?/i });
    return locatorByTestIdOr(this.page, RX_TEST_IDS.END_VISIT, fallback);
  }

  private get medicationSearchInput() {
    return locatorByTestIdOr(
      this.page,
      RX_TEST_IDS.MEDICATION_SEARCH,
      this.page.getByPlaceholder(/search medicines by name/i),
    );
  }

  async assertOnPrescriptionPad() {
    await expect(this.page).toHaveURL(
      new RegExp(`${PRESCRIPTION_TEST_DATA.routes.prescription}$`),
    );
    await expect(this.page).not.toHaveURL(/\/login/);
    await expect(this.endVisitButton).toBeVisible({ timeout: 20_000 });
  }

  async dismissPillUpTourIfPresent() {
    const okay = this.page.getByRole('button', { name: /^okay$/i });
    if (await okay.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await okay.click();
    }
  }

  /** Close overlays that block End Visit or save flow */
  async dismissPrescriptionBlockers() {
    await dismissRxBlockers(this.page, 'prescription-pad');
  }

  private async clickEndVisit() {
    await this.dismissPrescriptionBlockers();
    await dismissKnownBlockers(this.page, 'end-visit');

    await clickFirstResilient(
      this.page,
      [
        () => this.page.getByTestId(RX_TEST_IDS.END_VISIT),
        () => this.page.getByRole('button', { name: /end(\s+visit)?/i }),
        () =>
          this.page
            .locator('button')
            .filter({ has: this.page.locator('.icon-exit') })
            .filter({ hasText: /end/i }),
        () => this.endVisitButton,
      ],
      'end-visit',
    );
  }

  async assertMedicationsSectionVisible() {
    const medsSection = this.medicationsSection;
    await medsSection.scrollIntoViewIfNeeded();
    await expect(medsSection).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Search and select the first catalog medicine from autocomplete.
   * Returns parsed names for downstream assertions (dropdown vs row text differ).
   */
  async addMedicationFromSearch(searchTerm: string): Promise<SelectedMedication> {
    await this.appShell.dismissBlockingOverlays();
    await collapsePastVisitDataIfExpanded(this.page);
    await this.assertMedicationsSectionVisible();
    await this.medicationSearchInput.scrollIntoViewIfNeeded();
    await expect(this.medicationSearchInput).toBeVisible({ timeout: 10_000 });

    const searchResponse = this.page.waitForResponse(
      (res) =>
        res.url().includes(PRESCRIPTION_TEST_DATA.api.searchMedicine) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 15_000 },
    );

    await this.medicationSearchInput.click();
    await this.medicationSearchInput.fill('');
    await this.medicationSearchInput.fill(searchTerm);
    await searchResponse;

    await this.ensureAutocompleteOpen(this.medicationSearchInput);

    const medicineDropdown = this.page
      .locator('.medicine-parent-autocomplete-dropdown:not(.ant-select-dropdown-hidden)')
      .last();
    await expect(medicineDropdown).toBeVisible({ timeout: 10_000 });

    const visibleOption = medicineDropdown
      .locator('.ant-select-item-option')
      .filter({
        hasNotText:
          /add custom|add new medicine|FREQUENTLY USED|frequently used|search results/i,
      })
      .first();
    await expect(visibleOption).toBeVisible({ timeout: 10_000 });

    const optionText = (await visibleOption.innerText()).trim();
    const selectedMedication = parseMedicineDropdownText(optionText);
    expect(selectedMedication.brandName.length).toBeGreaterThan(0);

    await dismissKnownBlockers(this.page, 'medication-select');

    const detailsResponse = this.page.waitForResponse(
      (res) =>
        res.url().includes(PRESCRIPTION_TEST_DATA.api.getMedicineDetails) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 15_000 },
    );

    // Ant Design renders options in a fixed portal — Playwright actionability often reports "outside viewport".
    await visibleOption.evaluate((el) => (el as HTMLElement).click());
    await detailsResponse.catch(() => undefined);

    return selectedMedication;
  }

  private get medicationsSection() {
    return moduleBoxByTitle(
      this.page,
      'Medications',
      /medications?\s*\(rx\)|meds\s*\(rx\)|medicines?\s*\(rx\)/i,
    );
  }

  async assertMedicationAdded(medication: SelectedMedication) {
    const medsSection = this.medicationsSection;
    // Brand name appears in both .text-main2 span and the composition line — scope to first match.
    await expect(
      medsSection.locator('.text-main2', { hasText: medication.brandName })
        .or(medsSection.getByText(medication.brandName, { exact: false }).first()),
    ).toBeVisible({ timeout: 15_000 });

    if (medication.composition) {
      await expect(
        medsSection.getByText(medication.composition, { exact: false }),
      ).toBeVisible({ timeout: 15_000 });
    }

    await expect(this.medicationSearchInput).toHaveValue('');
    await this.dismissPrescriptionBlockers();
  }

  async endVisitAndWaitForSave(
    options?: EndVisitOptions,
    clickEndVisit?: () => Promise<void>,
  ): Promise<SaveVerificationContext> {
    await this.dismissPrescriptionBlockers();

    const requireMedicine = options?.requireMedicine ?? false;
    const minMedicineCount = options?.minMedicineCount ?? (requireMedicine ? 1 : 0);

    const addCaseManagerResponse = this.page.waitForResponse(
      (res) =>
        /casemanager\/(add|edit)casemanager/i.test(res.url()) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 45_000 },
    );

    const printViewNavigation = this.page.waitForURL(
      new RegExp(`${PRESCRIPTION_TEST_DATA.routes.printView}$`),
      { timeout: 45_000 },
    );

    if (clickEndVisit) {
      await clickEndVisit();
    } else {
      await this.clickEndVisit();
    }

    const [saveResponse] = await Promise.all([
      addCaseManagerResponse,
      printViewNavigation,
    ]);

    const body = await saveResponse.json();
    expect(isSuccessfulCaseManagerResponse(body)).toBe(true);

    const requestBody = saveResponse.request().postDataJSON();
    const context = buildSaveVerificationContext(body, requestBody);

    expect(context.tcmId, 'addCaseManager must return data.tcm_id').toBeGreaterThan(0);

    if (minMedicineCount > 0) {
      expect(
        context.savedMedicines.length,
        `addCaseManager must include at least ${minMedicineCount} medicine(s)`,
      ).toBeGreaterThanOrEqual(minMedicineCount);
    }

    return context;
  }

  async assertSaveSuccessToast() {
    if (this.page.url().includes(PRESCRIPTION_TEST_DATA.routes.printView)) {
      return;
    }

    await expect(
      this.page.getByText(PRESCRIPTION_TEST_DATA.messages.visitEnded),
    ).toBeVisible({ timeout: 10_000 });
  }
}
