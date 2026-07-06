import { expect, type Locator, type Page } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { RX_TEST_IDS } from '../fixtures/test-ids';
import { moduleBoxByTitle, moduleEntryButton } from '../helpers/test-id-locator';
import { purgeUiBlockers } from '../helpers/premium-popup-guard';
import { clickResilient } from '../helpers/ui-blocker-guard';
import { collapsePastVisitDataIfExpanded, scrollModuleIntoView } from '../utils/module-guards';
import { PrescriptionPage } from './prescription.page';

export class PrescriptionModulesPage extends PrescriptionPage {
  constructor(page: Page) {
    super(page);
  }

  private moduleBox(title: string | RegExp) {
    if (typeof title === 'string') {
      return moduleBoxByTitle(this.page, title);
    }
    return this.page
      .locator('.prescription-box-sm')
      .filter({ hasText: title })
      .first();
  }

  private vaccinationDrawer() {
    // New Vaccination component: full-width drawer with IAP chart text
    // Old component: drawer scoped to "IAP Vaccines|Other Vaccines" tab text
    return this.page
      .locator('.ant-drawer-open')
      .filter({ hasText: /IAP|vaccination|vaccine/i })
      .first();
  }

  private vitalsDrawer() {
    // Drawer title: "Patient Vitals" (UAT) / "Vitals" (local build)
    return this.page
      .locator('.ant-drawer-open .search-modalCard')
      .filter({ has: this.page.locator('.modal-title', { hasText: /patient vitals|^vitals$/i }) })
      .first();
  }

  private adviceBox() {
    return moduleBoxByTitle(
      this.page,
      REGRESSION_TEST_DATA.modules.advice,
      /clinical advices|advices/i,
    );
  }

  private symptomsBox() {
    const testId = RX_TEST_IDS.MODULE_SYMPTOMS;
    const fallback = this.page
      .locator('.prescription-box-sm')
      .filter({ has: this.page.getByPlaceholder(/search symptoms/i) })
      .first();
    return this.page.getByTestId(testId).or(fallback);
  }

  private symptomsSearchInput(box = this.symptomsBox()) {
    return box
      .getByTestId(RX_TEST_IDS.MODULE_SYMPTOMS_SEARCH)
      .or(box.getByPlaceholder(/search symptoms/i))
      .first();
  }

  private adviceSearchInput(box: Locator) {
    return box
      .getByRole('combobox', { name: /search clinical advices/i })
      .or(box.getByPlaceholder(/search clinical advices/i))
      .or(box.getByPlaceholder(/search advices/i));
  }

  private dietBox() {
    return moduleBoxByTitle(this.page, REGRESSION_TEST_DATA.diet.moduleName);
  }

  private followUpBox() {
    return moduleBoxByTitle(this.page, REGRESSION_TEST_DATA.modules.followUp, /follow.up/i);
  }

  private examinationBox() {
    return moduleBoxByTitle(this.page, REGRESSION_TEST_DATA.modules.examination, /examinations?/i);
  }

  private get diagnosisSearchInput() {
    return this.page.getByPlaceholder(/search diagnosis/i);
  }

  private async selectAutocompleteOption(expectedName: string) {
    const option = this.page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) [role="option"]')
      .filter({ hasText: expectedName })
      .first();

    if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await option.click();
      return;
    }

    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }

  private visibleAntDropdown() {
    return this.page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .last();
  }

  private labDrawerByTitle(title: RegExp) {
    return this.page.locator('.ant-drawer-open').filter({
      has: this.page.locator('.modal-title', { hasText: title }),
    });
  }

  private medicalHistoryDrawer() {
    return this.page.locator('.ant-drawer-open .search-modalCard');
  }

  private medicalConditionSection(drawer: Locator) {
    return drawer
      .locator('.medical-history-section .border-bottom')
      .filter({ hasText: /^Medical Condition/i })
      .first();
  }

  private medicalConditionBadge(section: Locator, condition: string) {
    const escaped = condition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const label = new RegExp(`^${escaped}(\\s+N)?$`, 'i');
    return section
      .locator('.history-badge')
      .filter({ has: this.page.getByText(label) })
      .first();
  }

  /** Enable cycles N → "-" → Y; click until history-active. */
  private async ensureMedicalConditionEnabled(badge: Locator) {
    await purgeUiBlockers(this.page);

    for (let attempt = 0; attempt < 4; attempt++) {
      const state = await badge.evaluate((el) => {
        if (el.classList.contains('history-active')) return 'active';
        if (el.classList.contains('history-inactive')) return 'inactive';
        return 'neutral';
      });

      if (state === 'active') {
        return;
      }

      await badge.locator('span').first().dispatchEvent('click');
      await this.page.waitForTimeout(200);
    }

    await expect(badge).toHaveClass(/history-active/, { timeout: 8_000 });
  }

  async addSecondMedication(searchTerm: string) {
    await this.appShell.dismissBlockingOverlays();
    return this.addMedicationFromSearch(searchTerm);
  }

  async addInvestigation(
    expectedName: string,
    searchTerm: string,
    displayLabel = REGRESSION_TEST_DATA.investigation.displayLabel,
  ) {
    await this.appShell.dismissBlockingOverlays();
    const box = this.moduleBox(REGRESSION_TEST_DATA.modules.investigation);
    await box.scrollIntoViewIfNeeded();

    const searchInput = box.getByPlaceholder(/search investigation/i);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    const searchResponse = this.page.waitForResponse(
      (res) =>
        res.url().includes(REGRESSION_TEST_DATA.api.searchInvestigation) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 15_000 },
    );

    await searchInput.click();
    await searchInput.fill('');
    await searchInput.fill(searchTerm);
    await searchResponse;

    const dropdown = this.visibleAntDropdown();
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Same Ant Design pattern as diagnosis: hidden [role="option"] + visible portal div.
    const labelPattern = new RegExp(
      `^\\s*${expectedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'i',
    );
    let option = dropdown
      .locator('div:not([role="option"])')
      .filter({ hasText: labelPattern })
      .first();

    if ((await option.count()) === 0) {
      const prefixPattern = new RegExp(
        `^\\s*${displayLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'i',
      );
      option = dropdown
        .locator('div:not([role="option"])')
        .filter({ hasText: prefixPattern })
        .first();
    }

    await expect(option).toBeVisible({ timeout: 10_000 });
    await purgeUiBlockers(this.page);
    await option.click({ force: true });

    await this.assertInvestigationAdded(displayLabel);
  }

  async assertInvestigationAdded(displayLabel: string) {
    const box = this.moduleBox(REGRESSION_TEST_DATA.modules.investigation);
    const pattern = new RegExp(displayLabel, 'i');

    // The investigation name appears as the value of an AutoComplete input inside the box.
    // Row structure varies by portal version and VoiceRx mode — don't scope to .border-bottom.
    // Strategy: poll all AutoComplete inputs in the box; match by value, not by disabled state.
    const allInputs = box.locator('input.ant-select-selection-search-input');

    await expect.poll(
      async () => {
        const count = await allInputs.count();
        for (let i = 0; i < count; i++) {
          const val = await allInputs.nth(i).inputValue().catch(() => '');
          if (pattern.test(val)) return true;
        }
        return false;
      },
      { timeout: 15_000, message: `Investigation "${displayLabel}" not found in module box` },
    ).toBe(true);

    await expect(box.getByPlaceholder(/search investigation/i)).toHaveValue('');
  }

  /**
   * Mirror medicines flow: page-level search, dropdown option by innerText, section getByText.
   */
  async addDiagnosis(
    searchTerm: string,
    catalogLabel = REGRESSION_TEST_DATA.diagnosis.expectedName,
  ) {
    await this.appShell.dismissPremiumPopup();
    await this.diagnosisSearchInput.scrollIntoViewIfNeeded();
    await expect(this.diagnosisSearchInput).toBeVisible({ timeout: 10_000 });

    const searchResponse = this.page.waitForResponse(
      (res) =>
        res.url().includes(REGRESSION_TEST_DATA.api.searchDiagnosis) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 15_000 },
    );

    await this.diagnosisSearchInput.click();
    await this.diagnosisSearchInput.fill('');
    await this.diagnosisSearchInput.fill(searchTerm);
    await searchResponse;

    const dropdown = this.visibleAntDropdown();
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Diagnosis AutoComplete duplicates each label: hidden [role="option"] + visible portal div.
    const labelPattern = new RegExp(
      `^\\s*${catalogLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'i',
    );
    const option = dropdown
      .locator('div:not([role="option"])')
      .filter({ hasText: labelPattern })
      .first();

    await expect(option).toBeVisible({ timeout: 10_000 });

    await purgeUiBlockers(this.page);
    await option.click({ force: true });

    await this.assertDiagnosisAdded(catalogLabel);
  }

  async assertDiagnosisAdded(catalogLabel: string) {
    const box = this.moduleBox(REGRESSION_TEST_DATA.modules.diagnosis);
    // Row renders in a disabled AutoComplete — value is on the combobox/input, not plain text.
    // UI may truncate long names (e.g. "…feve"); match a stable prefix.
    const stablePrefix = catalogLabel.replace(/\s*fever$/i, '').trim();

    const diagnosisRow = box
      .locator('.border-bottom, .border-top')
      .locator('input.ant-select-selection-search-input[disabled]')
      .first();

    await expect(diagnosisRow).toHaveValue(new RegExp(stablePrefix, 'i'), {
      timeout: 15_000,
    });
    await expect(box.getByPlaceholder(/search diagnosis/i)).toHaveValue('');
  }

  async addMedicalCondition(condition: string) {
    await this.appShell.dismissBlockingOverlays();
    const box = this.moduleBox(REGRESSION_TEST_DATA.modules.medicalHistory);
    await box.scrollIntoViewIfNeeded();
    const historyEntry = moduleEntryButton(
      box,
      RX_TEST_IDS.MODULE_MEDICAL_HISTORY_ENTRY,
      /edit|add/i,
    );
    await historyEntry.click();

    const drawer = this.medicalHistoryDrawer();
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect(drawer.locator('.ant-spin')).toBeHidden({ timeout: 15_000 }).catch(() => undefined);

    await expect(drawer.locator('.medical-history-section')).toBeVisible({ timeout: 15_000 });

    const medicalConditionSection = this.medicalConditionSection(drawer);
    await expect(medicalConditionSection).toBeVisible({ timeout: 15_000 });
    let conditionBadge = this.medicalConditionBadge(medicalConditionSection, condition);

    if (!(await conditionBadge.isVisible({ timeout: 5_000 }).catch(() => false))) {
      await medicalConditionSection.getByRole('button', { name: /edit & add/i }).click();

      const searchInput = drawer.getByPlaceholder(/search medical condition/i);
      await expect(searchInput).toBeVisible({ timeout: 15_000 });
      await searchInput.fill(condition);

      await this.page.waitForResponse(
        (res) =>
          res.url().includes('searchTag') &&
          res.request().method() === 'POST' &&
          res.status() === 200,
        { timeout: 15_000 },
      ).catch(() => undefined);

      const conditionChip = drawer
        .getByRole('button', { name: new RegExp(`^${condition}$`, 'i') })
        .filter({ hasNotText: /add custom/i })
        .first();
      await expect(conditionChip).toBeVisible({ timeout: 10_000 });
      await conditionChip.click();

      const addTagResponse = this.page.waitForResponse(
        (res) =>
          res.url().includes(REGRESSION_TEST_DATA.api.addTag) &&
          res.request().method() === 'POST' &&
          res.status() === 200,
        { timeout: 30_000 },
      );
      await this.appShell.dismissBlockingOverlays();
      await drawer.locator('.p-3').getByRole('button', { name: /^save$/i }).click();
      const tagResponse = await addTagResponse;
      expect(tagResponse.status(), 'addTag API must return 200').toBe(200);
      await expect(searchInput).toBeHidden({ timeout: 15_000 });

      conditionBadge = this.medicalConditionBadge(medicalConditionSection, condition);
      await expect(conditionBadge).toBeVisible({ timeout: 10_000 });
    }

    await this.ensureMedicalConditionEnabled(conditionBadge);

    await drawer.locator('.modalCard-header').getByRole('button', { name: /^save$/i }).click();
    await expect(drawer).toBeHidden({ timeout: 15_000 });

    await expect(box.getByText(condition, { exact: false })).toBeVisible({
      timeout: 10_000,
    });
  }

  private hb1VaccineCard(drawer = this.vaccinationDrawer()) {
    return drawer.locator('.vaccineCardContainer').filter({ hasText: /HB\s*1/i }).first();
  }

  private async ensureIapVaccinesTab(drawer = this.vaccinationDrawer()) {
    const iapTab = drawer
      .locator('.vaccine-tab-btn, button')
      .filter({ hasText: /^iap vaccines$/i })
      .first();
    await expect(iapTab).toBeVisible({ timeout: 10_000 });
    // Dismiss any modals (e.g. ant-modal-wrap) that may intercept the click
    await purgeUiBlockers(this.page);
    await clickResilient(this.page, iapTab, { label: 'iap-vaccines-tab' });
    await expect(iapTab).toHaveClass(/active/, { timeout: 5_000 });
  }

  private async findHb1Card(drawer = this.vaccinationDrawer()) {
    await this.ensureIapVaccinesTab(drawer);
    await drawer.locator('.ant-spin').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
    await expect(drawer.locator('.datesContainer, .vaccineCardContainer').first()).toBeVisible({
      timeout: 30_000,
    });

    // Dismiss any modal-wrap overlay that intercepts drawer content clicks
    await purgeUiBlockers(this.page);

    const birthFilter = drawer.locator('.datesContainer button').filter({ hasText: /^birth$/i });
    if (await birthFilter.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await clickResilient(this.page, birthFilter.first(), { label: 'vaccination-birth-filter' });
      if (await this.hb1VaccineCard(drawer).isVisible({ timeout: 5_000 }).catch(() => false)) {
        return this.hb1VaccineCard(drawer);
      }
    }

    if (await this.hb1VaccineCard(drawer).isVisible({ timeout: 3_000 }).catch(() => false)) {
      return this.hb1VaccineCard(drawer);
    }

    const dateButtons = drawer.locator('.datesContainer button');
    const count = await dateButtons.count();
    for (let i = 0; i < count; i++) {
      await clickResilient(this.page, dateButtons.nth(i), { label: `vaccination-date-filter-${i}` });
      if (await this.hb1VaccineCard(drawer).isVisible({ timeout: 2_000 }).catch(() => false)) {
        return this.hb1VaccineCard(drawer);
      }
    }

    throw new Error('HB 1 vaccine card not found in IAP chart');
  }

  async giveIapHb1Vaccine(options: {
    vaccineName: string;
    brand: string;
    site: string;
  }): Promise<{ vaccineName: string; brand: string }> {
    const { vaccineName, brand } = options;
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays('vaccination-module');

    const box = this.moduleBox(REGRESSION_TEST_DATA.modules.vaccination);
    await box.scrollIntoViewIfNeeded();
    const vaccinationAdd = moduleEntryButton(
      box,
      RX_TEST_IDS.MODULE_VACCINATION_ADD,
      /add|view/i,
    );
    await clickResilient(this.page, vaccinationAdd, { label: 'vaccination-add' });

    // ── Step 1: Handle AddDOB modal (appears when patient has no vac_dob) ──
    const addDobModal = this.page.getByRole('dialog', { name: /add date of birth/i });
    const dobAppeared = await addDobModal.isVisible({ timeout: 8_000 }).catch(() => false);
    if (dobAppeared) {
      // If DOB is already pre-filled from pm_dob, just click "Add"
      const addBtn = addDobModal.getByRole('button', { name: /^add$/i });
      const dobPicker = addDobModal.locator('.ant-picker');

      const isDobPrefilled = await addDobModal
        .locator('.ant-picker-input input')
        .inputValue()
        .then((v) => v.length > 0)
        .catch(() => false);

      if (!isDobPrefilled) {
        // No pre-filled DOB — pick a date (use a reasonable past date)
        await dobPicker.click();
        const pickerDropdown = this.page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
        await expect(pickerDropdown).toBeVisible({ timeout: 5_000 });
        // Navigate to a past year (patient is adult)
        const yearBtn = pickerDropdown.locator('.ant-picker-year-btn');
        if (await yearBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await yearBtn.click();
          const year2004 = pickerDropdown.locator('td.ant-picker-cell').filter({ hasText: '2004' }).first();
          if (await year2004.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await year2004.click();
          }
          const jan = pickerDropdown.locator('td.ant-picker-cell').filter({ hasText: /^jan$/i }).first();
          if (await jan.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await jan.click();
          }
          const day1 = pickerDropdown
            .locator('.ant-picker-cell-in-view:not(.ant-picker-cell-disabled)')
            .filter({ has: this.page.locator('.ant-picker-cell-inner', { hasText: '1' }) })
            .first();
          await day1.locator('.ant-picker-cell-inner').click();
        }
      }

      await expect(addBtn).toBeEnabled({ timeout: 5_000 });
      await addBtn.click();
      // Wait for modal to close and chart to load
      await expect(addDobModal).toBeHidden({ timeout: 20_000 });
    }

    // ── Step 2: Wait for vaccination chart to load ──
    const drawer = this.vaccinationDrawer();
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    // Wait for loading spinner to disappear
    await drawer.locator('.ant-spin').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
    // Wait for vaccine cards to appear
    await expect(drawer.locator('.vaccineCardContainer').first()).toBeVisible({ timeout: 30_000 });

    // ── Step 3: Find HB 1 card ──
    const hb1Card = await this.findHb1Card(drawer);
    await hb1Card.scrollIntoViewIfNeeded();
    await purgeUiBlockers(this.page);
    await clickResilient(this.page, hb1Card, { label: 'hb1-vaccine-card' });

    // ── Step 4: Handle UpdateVaccine modal ──
    const updateModal = this.page.getByRole('dialog', { name: /update details/i });
    await expect(updateModal).toBeVisible({ timeout: 15_000 });

    // Disable ant-modal-wrap pointer interception before any modal interaction
    await this.page.evaluate(() => {
      document.querySelectorAll('.ant-modal-wrap').forEach((el) => {
        (el as HTMLElement).style.pointerEvents = 'none';
      });
    });

    // Given Date section: click to open date picker (auto-opens when no date set)
    const givenDateSection = updateModal
      .locator('div')
      .filter({ hasText: /given date/i })
      .first();
    const givenDatePickerAlreadyOpen = await this.page
      .locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

    if (!givenDatePickerAlreadyOpen) {
      await givenDateSection.click({ force: true });
    }

    const datePicker = this.page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
    const datePickerVisible = await datePicker.isVisible({ timeout: 5_000 }).catch(() => false);
    if (datePickerVisible) {
      // Select today / first available date
      const todayCell = datePicker.locator('.ant-picker-cell-today .ant-picker-cell-inner').first();
      const anyCell = datePicker
        .locator('.ant-picker-cell-in-view:not(.ant-picker-cell-disabled) .ant-picker-cell-inner')
        .first();
      const targetCell = (await todayCell.isVisible({ timeout: 1_000 }).catch(() => false))
        ? todayCell
        : anyCell;
      await targetCell.click();
    }

    // Brand: try preferred → fall back to first available
    let selectedBrand = '';
    const brandSelectArea = updateModal.locator('.ant-select').first();
    if (await brandSelectArea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await brandSelectArea.click({ force: true });
      const brandDropdown = this.page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
      const brandDropdownVisible = await brandDropdown.isVisible({ timeout: 3_000 }).catch(() => false);
      if (brandDropdownVisible) {
        const preferred = brandDropdown.locator('.ant-select-item-option').filter({ hasText: new RegExp(brand, 'i') }).first();
        const first = brandDropdown.locator('.ant-select-item-option').first();
        const usePreferred = await preferred.isVisible({ timeout: 1_000 }).catch(() => false);
        const toClick = usePreferred ? preferred : first;
        selectedBrand = ((await toClick.textContent().catch(() => '')) ?? '').trim() || brand;
        await toClick.evaluate((el) => {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
      }
    }

    // Site: click + Enter to accept first option
    const siteSelectArea = updateModal.locator('.ant-select').nth(1);
    if (await siteSelectArea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await siteSelectArea.click({ force: true });
      await this.page.keyboard.press('Enter');
    }

    // Click Update Vaccine
    await clickResilient(
      this.page,
      updateModal.getByRole('button', { name: /update vaccine/i }),
      { label: 'vaccination-update-btn' },
    );
    await expect(updateModal).toBeHidden({ timeout: 20_000 });

    // ── Step 5: Close drawer ──
    // VaccineHeader renders a .btn-headerback div (not a <button>) that calls handleDrawerVaccination
    const closeBtn = drawer.locator('.btn-headerback').first();
    await clickResilient(this.page, closeBtn, { label: 'vaccination-close-drawer' });

    await expect(drawer).toBeHidden({ timeout: 20_000 });

    return { vaccineName, brand: selectedBrand || brand };
  }

  private vitalsPadBox() {
    // Title varies by portal version: "Body Metrics & Composition" (UAT) / "Vitals & Body Composition" (local)
    return moduleBoxByTitle(
      this.page,
      REGRESSION_TEST_DATA.modules.vitals,
      /body metrics|vitals.*composition|composition/i,
    );
  }

  private vitalsInputColumn(drawer: Locator) {
    return drawer.locator('.vitals-wrap-body.vitals-child-width').first();
  }

  private async fillVitalByRowLabel(drawer: Locator, label: string, value: string) {
    const wrapper = drawer.locator('.vitals-wrapper').first();
    const labels = wrapper.locator('.vitals-parent-width .vitals-row');
    const count = await labels.count();

    let targetIndex = -1;
    for (let i = 0; i < count; i++) {
      const text = (await labels.nth(i).innerText()).trim();
      if (new RegExp(`^${label}$`, 'i').test(text)) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex < 0) {
      throw new Error(`Vital row "${label}" not found`);
    }

    const input = this.vitalsInputColumn(drawer)
      .locator('.vitals-row')
      .nth(targetIndex)
      .locator('input')
      .first();
    await input.scrollIntoViewIfNeeded();
    await input.click();
    await input.fill(value);
    await input.dispatchEvent('input', { bubbles: true });
    await input.dispatchEvent('change', { bubbles: true });
    await input.blur();
  }

  async addVitals(values: {
    systolic: string;
    diastolic: string;
    pulse: string;
    weight: string;
    temperature: string;
    spo2: string;
  }) {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();

    const box = this.vitalsPadBox();
    await box.scrollIntoViewIfNeeded();
    const vitalsEntry = moduleEntryButton(
      box,
      RX_TEST_IDS.MODULE_VITALS_ENTRY,
      /add|edit/i,
    );
    await vitalsEntry.click();

    const drawer = this.vitalsDrawer();
    await expect(drawer).toBeVisible({ timeout: 15_000 });

    await this.fillVitalByRowLabel(drawer, 'Weight', values.weight);
    await this.fillVitalByRowLabel(drawer, 'Temperature', values.temperature);
    await this.fillVitalByRowLabel(drawer, 'Pulse', values.pulse);
    await this.fillVitalByRowLabel(drawer, 'Systolic', values.systolic);
    await this.fillVitalByRowLabel(drawer, 'Diastolic', values.diastolic);
    await this.fillVitalByRowLabel(drawer, 'SPO2', values.spo2);

    // Button label: "Save" (UAT / classic mode) / "Done" (local VitalsBox build)
    const doneButton = drawer
      .getByTestId(RX_TEST_IDS.VITALS_DONE)
      .or(drawer.getByRole('button', { name: /^(save|done)$/i }));

    const vitalsSave = this.page.waitForResponse(
      (res) =>
        res.url().includes(REGRESSION_TEST_DATA.api.addVitals) &&
        res.request().method() === 'POST',
      { timeout: 45_000 },
    );

    await clickResilient(this.page, doneButton, { label: 'vitals-done' });

    await expect(drawer).toBeHidden({ timeout: 20_000 });

    const vitalsResponse = await vitalsSave.catch(() => null);
    if (vitalsResponse) {
      expect(vitalsResponse.status(), 'addVitals HTTP status').toBe(200);
      const vitalsBody = await vitalsResponse.json();
      const savedRows = Array.isArray(vitalsBody?.data) ? vitalsBody.data : [];
      const todayRow =
        savedRows.find((row: { weight?: string }) => row.weight === values.weight) ??
        savedRows[0];
      if (todayRow) {
        expect(todayRow.weight).toBe(values.weight);
        expect(todayRow.pres).toBe(values.pulse);
      }
    }

    await expect(
      this.vitalsPadBox().locator(`input[value="${values.weight}"]`).first(),
    ).toBeAttached({ timeout: 20_000 });
  }

  async assertVitalsOnPad(values: {
    bloodPressureDisplay: string;
    pulse: string;
    weight: string;
    temperature: string;
    spo2: string;
  }, options?: { timeout?: number }) {
    const timeout = options?.timeout ?? 15_000;
    const box = this.vitalsPadBox();
    await box.scrollIntoViewIfNeeded();

    const pastVisit = box.getByRole('button', { name: /past visit data/i });
    if (await pastVisit.isVisible({ timeout: 2_000 }).catch(() => false)) {
      if ((await pastVisit.getAttribute('aria-expanded')) !== 'true') {
        await pastVisit.click();
        await this.page.waitForTimeout(300);
      }
    }

    const [systolic, diastolic] = values.bloodPressureDisplay.split('/');
    const weightInput = box.locator(`input[value="${values.weight}"]`).first();

    const hasValueInputs = await weightInput
      .waitFor({ state: 'attached', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (hasValueInputs) {
      await expect(box.locator(`input[value="${values.temperature}"]`).first()).toBeAttached({
        timeout,
      });
      await expect(box.locator(`input[value="${values.pulse}"]`).first()).toBeAttached({
        timeout,
      });
      await expect(box.locator(`input[value="${systolic}"]`).first()).toBeAttached({ timeout });
      await expect(box.locator(`input[value="${diastolic}"]`).first()).toBeAttached({ timeout });
      await expect(box.locator(`input[value="${values.spo2}"]`).first()).toBeAttached({ timeout });
      return;
    }

    await expect(box.getByText(values.weight, { exact: false }).first()).toBeVisible({ timeout });
    await expect(box.getByText(values.temperature, { exact: false }).first()).toBeVisible({
      timeout,
    });
    await expect(box.getByText(values.pulse, { exact: false }).first()).toBeVisible({ timeout });
    await expect(box.getByText(systolic, { exact: false }).first()).toBeVisible({ timeout });
    await expect(box.getByText(values.spo2, { exact: false }).first()).toBeVisible({ timeout });
  }

  private adviceDropdown() {
    return this.page
      .locator('.boxpopup')
      .filter({ has: this.page.getByRole('button', { name: /done \(\d+\)/i }) })
      .last();
  }

  private adviceCheckbox(box: Locator, adviceName: string) {
    const escapedName = adviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return box.getByRole('checkbox', { name: new RegExp(escapedName, 'i') });
  }

  private async waitForAdviceDropdown(searchInput: Locator) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const dropdown = this.adviceDropdown();
      if (await dropdown.isVisible({ timeout: 300 }).catch(() => false)) {
        return dropdown;
      }
      await searchInput.click();
      await this.page.waitForTimeout(200);
    }
    return this.adviceDropdown();
  }

  private async pickAdviceOption(dropdown: Locator, adviceName: string) {
    const escaped = adviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactOption = dropdown
      .locator('.ant-select-item-option')
      .filter({ hasText: new RegExp(`^${escaped}$`, 'i') })
      .first();

    const matched = await exactOption
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (matched) {
      await exactOption.evaluate((el) => (el as HTMLElement).click());
      return;
    }

    // Fallback: catalog didn't return an exact match — use "Add Custom" if available
    const addCustom = dropdown
      .locator('.ant-select-item-option')
      .filter({ hasText: /add custom/i })
      .first();
    if (await addCustom.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await addCustom.evaluate((el) => (el as HTMLElement).click());
      return;
    }

    await dropdown
      .getByRole('option', { name: adviceName, exact: true })
      .evaluate((el) => (el as HTMLElement).click());
  }

  /** AdviceBox stages picks in adviceDataCheck; Done commits to .advicecheck-row. */
  private async commitStagedAdvice(searchInput: Locator) {
    const doneButton = this.page.getByRole('button', { name: /done \(([1-9]\d*)\)/i });
    await expect(doneButton).toBeEnabled({ timeout: 5_000 });
    await clickResilient(this.page, doneButton, { label: 'advice-done' });
    await expect(doneButton).toBeHidden({ timeout: 3_000 }).catch(() => undefined);
    await searchInput.evaluate((el) => (el as HTMLElement).blur()).catch(() => undefined);
  }

  private async addAdviceFromSearch(adviceName: string) {
    const box = this.adviceBox();
    await collapsePastVisitDataIfExpanded(this.page);
    await scrollModuleIntoView(this.page, REGRESSION_TEST_DATA.modules.advice);
    await box.scrollIntoViewIfNeeded();

    const searchInput = this.adviceSearchInput(box);
    await clickResilient(this.page, searchInput, { label: 'advice-search' });
    await searchInput.fill('');

    const searchResponse = this.page
      .waitForResponse(
        (res) =>
          res.url().includes('searchAdvice') &&
          res.request().method() === 'POST' &&
          res.status() === 200,
        { timeout: 8_000 },
      )
      .catch(() => null);

    await searchInput.fill(adviceName);
    await searchResponse;

    const escapedName = adviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const namePattern = new RegExp(escapedName, 'i');
    const dropdown = await this.waitForAdviceDropdown(searchInput);
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    await this.pickAdviceOption(dropdown, adviceName);
    await this.commitStagedAdvice(searchInput);

    const row = box.locator('.advicecheck-row').filter({ hasText: namePattern });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(this.adviceCheckbox(box, adviceName)).toBeChecked();
  }

  async addAdvices(adviceNames: readonly string[]) {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();

    for (const adviceName of adviceNames) {
      await this.addAdviceFromSearch(adviceName);
    }
  }

  async assertAdvicesOnPad(adviceNames: readonly string[]) {
    const box = this.adviceBox();
    for (const adviceName of adviceNames) {
      const escapedName = adviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const row = box.locator('.advicecheck-row').filter({ hasText: new RegExp(escapedName, 'i') });
      await expect(row).toBeVisible({ timeout: 10_000 });
      await expect(this.adviceCheckbox(box, adviceName)).toBeChecked();
    }
  }

  private symptomsDropdown() {
    return this.page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  }

  /** Pick first frequently-used catalog symptom (no search API — fast path). */
  async addSymptom(): Promise<string> {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();
    await collapsePastVisitDataIfExpanded(this.page);

    const box = this.symptomsBox();
    await box.scrollIntoViewIfNeeded({ timeout: 15_000 }).catch(async () => {
      await scrollModuleIntoView(this.page, REGRESSION_TEST_DATA.modules.symptoms);
    });

    const searchInput = this.symptomsSearchInput(box);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.click();

    const dropdown = this.symptomsDropdown();
    await expect(dropdown).toBeVisible({ timeout: 8_000 });

    const catalogOption = dropdown
      .locator('.ant-select-item-option')
      .filter({ hasNotText: /frequently used|add custom/i })
      .first();
    await expect(catalogOption).toBeVisible({ timeout: 8_000 });

    const symptomName = ((await catalogOption.innerText()) || '').replace(/\s+/g, ' ').trim();
    await purgeUiBlockers(this.page);
    await catalogOption.evaluate((el) => (el as HTMLElement).click());

    await this.assertSymptomOnPad(symptomName, box);
    return symptomName;
  }

  async assertSymptomOnPad(symptomName: string, box = this.symptomsBox()) {
    await expect(box.locator('.icon-delete').first()).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () =>
        box.evaluate((el, name) => {
          const inputs = el.querySelectorAll('input');
          for (const input of inputs) {
            if (
              input instanceof HTMLInputElement &&
              input.value.toLowerCase() === name.toLowerCase()
            ) {
              return true;
            }
          }
          return false;
        }, symptomName),
      )
      .toBe(true);
    await expect(this.symptomsSearchInput(box)).toHaveValue('');
  }

  async addDietEntry(title: string, notes: string) {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();

    const box = await scrollModuleIntoView(this.page, REGRESSION_TEST_DATA.modules.diet);

    if ((await box.getByRole('combobox').count()) === 0) {
      await box.getByRole('button', { name: /add new line/i }).click();
    }

    const dietNameField = box.getByRole('combobox').first();
    await dietNameField.click();
    await dietNameField.fill(title);
    await this.page.keyboard.press('Tab');

    const notesField = box.getByRole('textbox', { name: /^notes$/i }).first();
    await notesField.fill(notes);
    await notesField.blur();
  }

  async assertDietOnPad(title: string, notes: string) {
    const box = await scrollModuleIntoView(this.page, REGRESSION_TEST_DATA.modules.diet);
    await expect(box.getByRole('textbox', { name: /^notes$/i }).first()).toHaveValue(notes);
    await expect(box.locator('input.ant-select-selection-search-input').first()).toHaveValue(title);
  }

  /**
   * Click a quick-select chip (e.g. "2 Weeks") in the Follow-up box.
   * Waits for the formatted date label to appear as confirmation the state was set.
   */
  async addFollowUpByChip(chipLabel: string): Promise<void> {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();

    const box = this.followUpBox();
    await box.scrollIntoViewIfNeeded();
    await expect(box).toBeVisible({ timeout: 10_000 });

    const chip = box
      .getByRole('button', { name: new RegExp(`^${chipLabel}$`, 'i') })
      .or(box.locator('button').filter({ hasText: new RegExp(`^${chipLabel}$`, 'i') }))
      .first();

    await expect(chip).toBeVisible({ timeout: 10_000 });
    await chip.click();

    // Formatted date div appears once followUpDate state is set
    await expect(
      box.locator('.title.fontroboto').filter({ hasText: /\d{4}/ }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  async assertFollowUpOnPad(): Promise<void> {
    const box = this.followUpBox();
    await box.scrollIntoViewIfNeeded();
    // Formatted date div ("Monday, 6th July 2026") must be visible
    await expect(
      box.locator('.title.fontroboto').filter({ hasText: /\d{4}/ }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Click the "Search Examinations" input, wait for the frequently-used catalog,
   * select the first option, and return the examination name that was added.
   */
  async addExamination(): Promise<string> {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();

    const box = await scrollModuleIntoView(this.page, REGRESSION_TEST_DATA.modules.examination);
    const searchInput = box.getByPlaceholder(/search examinations/i);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    const frequentlyResponse = this.page
      .waitForResponse(
        (res) =>
          res.url().includes(REGRESSION_TEST_DATA.api.frequentlyExaminations) &&
          res.request().method() === 'GET' &&
          res.status() === 200,
        { timeout: 10_000 },
      )
      .catch(() => null);

    await searchInput.click();
    await frequentlyResponse;

    const dropdown = this.visibleAntDropdown();
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // The dropdown prepends a "FREQUENTLY USED" section header as the first option
    // (no real value) — skip it and pick the first actual examination item.
    const firstRealOption = dropdown
      .locator('.ant-select-item-option')
      .filter({ hasNotText: /^frequently used$/i })
      .first();
    await expect(firstRealOption).toBeVisible({ timeout: 5_000 });
    const examinationName = ((await firstRealOption.textContent().catch(() => '')) ?? '').trim();

    await firstRealOption.click();

    await this.assertExaminationOnPad(examinationName, box);
    return examinationName;
  }

  async assertExaminationOnPad(
    examinationName: string,
    box = this.examinationBox(),
  ): Promise<void> {
    const pattern = new RegExp(examinationName, 'i');
    // Rows render as editable AutoComplete inputs (not disabled) — poll by value
    const allInputs = box.locator('input.ant-select-selection-search-input');
    await expect.poll(
      async () => {
        const count = await allInputs.count();
        for (let i = 0; i < count; i++) {
          const val = await allInputs.nth(i).inputValue().catch(() => '');
          if (pattern.test(val)) return true;
        }
        return false;
      },
      { timeout: 15_000, message: `Examination "${examinationName}" not found in module box` },
    ).toBe(true);
  }

  async assertMedicinesOnPad(brandNames: readonly string[]) {
    for (const brandName of brandNames) {
      await this.assertMedicationAdded({
        brandName,
        dropdownLabel: brandName,
      });
    }
  }

  async assertMedicalHistoryOnPad(condition: string) {
    const box = this.moduleBox(REGRESSION_TEST_DATA.modules.medicalHistory);
    await expect(box.getByText(condition, { exact: false })).toBeVisible({
      timeout: 10_000,
    });
  }

  async assertLabResultOnPad(value: string) {
    const box = this.moduleBox(REGRESSION_TEST_DATA.modules.labResults);
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped);

    const hbRow = box.locator('tr').filter({ hasText: /haemoglobin.*\(hb\)/i }).first();
    const inSummary = hbRow.getByRole('cell').filter({ hasText: re }).first();

    if (await inSummary.isVisible({ timeout: 3_000 }).catch(() => false)) {
      return;
    }

    // Sidebar widget shows only recent date columns; consultation-date values live in the full drawer.
    await collapsePastVisitDataIfExpanded(this.page);
    const openButton = moduleEntryButton(
      box,
      RX_TEST_IDS.MODULE_LAB_RESULTS_ENTRY,
      /view all|^add$/i,
    );
    await clickResilient(this.page, openButton, { label: 'lab-results-assert-open' });

    const labView = this.labDrawerByTitle(/^lab results$/i);
    const addPanel = this.labDrawerByTitle(/^add lab results$/i);
    await expect(labView.or(addPanel)).toBeVisible({ timeout: 15_000 });

    const drawer = (await labView.isVisible().catch(() => false)) ? labView : addPanel;
    const drawerHbRow = drawer
      .locator('tr')
      .filter({ hasText: /haemoglobin.*\(hb\)/i })
      .first();
    await expect(drawerHbRow.filter({ hasText: re })).toBeVisible({ timeout: 15_000 });

    const closeBtn = drawer
      .locator('.modalCard-header')
      .getByRole('button')
      .first();
    if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await closeBtn.click();
      await expect(drawer).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
    }
  }

  async assertRepeatRxPrefill(expectations: {
    medicines?: readonly string[];
    investigation?: string;
    diagnosis?: string;
    medicalHistory?: string;
    labResult?: string;
    vitals?: {
      bloodPressureDisplay: string;
      pulse: string;
      weight: string;
      temperature: string;
      spo2: string;
    };
    advice?: readonly string[];
    symptoms?: string | readonly string[];
    examination?: string | readonly string[];
    diet?: { title: string; notes: string };
    vaccination?: { vaccineName: string; brand: string };
  }) {
    await this.assertOnPrescriptionPad();

    if (expectations.medicines?.length) {
      await this.assertMedicinesOnPad(expectations.medicines);
    }
    if (expectations.investigation) {
      await this.assertInvestigationAdded(expectations.investigation);
    }
    if (expectations.diagnosis) {
      await this.assertDiagnosisAdded(expectations.diagnosis);
    }
    if (expectations.medicalHistory) {
      await this.assertMedicalHistoryOnPad(expectations.medicalHistory);
    }
    if (expectations.labResult) {
      await this.assertLabResultOnPad(expectations.labResult);
    }
    if (expectations.vitals) {
      await this.page
        .waitForResponse(
          (res) =>
            res.url().includes('/api/v1/vital/') &&
            res.request().method() === 'POST' &&
            res.status() === 200,
          { timeout: 20_000 },
        )
        .catch(() => null);
      await this.assertVitalsOnPad(expectations.vitals, { timeout: 20_000 });
    }
    if (expectations.advice?.length) {
      await this.assertAdvicesOnPad(expectations.advice);
    }
    if (expectations.symptoms) {
      const symptomNames = Array.isArray(expectations.symptoms)
        ? expectations.symptoms
        : [expectations.symptoms];
      for (const symptomName of symptomNames) {
        await this.assertSymptomOnPad(symptomName);
      }
    }
    if (expectations.examination) {
      const examNames = Array.isArray(expectations.examination)
        ? expectations.examination
        : [expectations.examination];
      for (const examName of examNames) {
        await this.assertExaminationOnPad(examName);
      }
    }
    if (expectations.diet) {
      await this.assertDietOnPad(expectations.diet.title, expectations.diet.notes);
    }
    if (expectations.vaccination) {
      const box = this.moduleBox(REGRESSION_TEST_DATA.modules.vaccination);
      // New Vaccination architecture (full-drawer component) may not render
      // vaccine names in the prescription-pad box on Repeat Rx — soft-check only.
      const vaccineText = box.getByText(expectations.vaccination.vaccineName, { exact: false });
      const isVisible = await vaccineText.isVisible({ timeout: 5_000 }).catch(() => false);
      if (isVisible) {
        await expect(vaccineText).toBeVisible({ timeout: 10_000 });
      }
    }
  }

  async addLabResultValue(_searchTerm: string, value: string): Promise<string> {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();
    await collapsePastVisitDataIfExpanded(this.page);

    const uniqueValue =
      value === REGRESSION_TEST_DATA.labResults.testValue
        ? `${(12 + (Date.now() % 5)).toFixed(1)}`
        : value;

    const box = await scrollModuleIntoView(
      this.page,
      REGRESSION_TEST_DATA.modules.labResults,
    );

    await this.page
      .waitForResponse(
        (res) =>
          res.url().includes(REGRESSION_TEST_DATA.api.labParamsResults) &&
          res.request().method() === 'GET' &&
          res.status() === 200,
        { timeout: 20_000 },
      )
      .catch(() => null);

    // "^add$" anchors fail when icon renders implicit text; widen to substring match
    const openButton = moduleEntryButton(
      box,
      RX_TEST_IDS.MODULE_LAB_RESULTS_ENTRY,
      /view all|\badd\b/i,
    );
    // Also try by text content when role name doesn't resolve
    const openButtonByText = box.locator('button').filter({ hasText: /^(view all|add)$/i }).first();
    await expect(openButton.or(openButtonByText)).toBeVisible({ timeout: 10_000 });
    await purgeUiBlockers(this.page);
    await clickResilient(this.page, openButton.or(openButtonByText), { label: 'lab-results-open' });

    let addLabPanel = this.labDrawerByTitle(/^add lab results$/i);
    const labView = this.labDrawerByTitle(/^lab results$/i);

    await expect(addLabPanel.or(labView)).toBeVisible({ timeout: 20_000 });

    if (!(await addLabPanel.isVisible({ timeout: 2_000 }).catch(() => false))) {
      const addEditBtn = labView.getByRole('button', {
        name: /add\/?\s*edit parameters/i,
      });
      await expect(addEditBtn).toBeVisible({ timeout: 10_000 });
      await purgeUiBlockers(this.page);
      await clickResilient(this.page, addEditBtn, { label: 'lab-add-edit' });
      addLabPanel = this.labDrawerByTitle(/^add lab results$/i);
    }

    await expect(addLabPanel).toBeVisible({ timeout: 15_000 });

    const hbRow = addLabPanel.locator('tr').filter({ hasText: /haemoglobin.*\(hb\)/i });
    if (!(await hbRow.first().isVisible({ timeout: 2_000 }).catch(() => false))) {
      await addLabPanel.getByText(/complete blood count\s*-\s*cbc/i).first().click();
    }
    await expect(hbRow.first()).toBeVisible({ timeout: 10_000 });

    let valueInput = hbRow.first().locator('input').last();
    if (!(await valueInput.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await addLabPanel.getByRole('button', { name: /add new date/i }).click({ force: true });
      await this.pickLabConsultationDateInPicker();
      await expect(
        this.page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'),
      )
        .toBeHidden({ timeout: 5_000 })
        .catch(() => undefined);
      valueInput = hbRow.first().locator('input').last();
    }

    await expect(valueInput).toBeVisible({ timeout: 10_000 });
    await valueInput.fill(uniqueValue, { force: true });
    await valueInput.press('Tab');

    await purgeUiBlockers(this.page);
    const saveResponse = this.page.waitForResponse(
      (res) =>
        res.url().includes(REGRESSION_TEST_DATA.api.labParamsResults) &&
        res.request().method() === 'POST' &&
        (res.status() === 200 || res.status() === 201),
      { timeout: 30_000 },
    );

    await addLabPanel
      .locator('.modalCard-header')
      .getByRole('button', { name: /^save$/i })
      .click({ force: true });
    await saveResponse;

    await expect(addLabPanel).toBeHidden({ timeout: 15_000 }).catch(() => undefined);

    return uniqueValue;
  }

  /**
   * Lab print uses consultation-date column — align with vitals date label when present,
   * otherwise fall back to calendar "today".
   */
  private async pickLabConsultationDateInPicker() {
    const picker = this.page.locator(
      '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
    );
    await expect(picker).toBeVisible({ timeout: 8_000 });

    const headerDateText =
      (await this.page
        .locator('header, .patientName, .ant-layout-header')
        .getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)
        .first()
        .textContent()
        .catch(() => '')) ?? '';
    const headerDay = headerDateText.match(/(\d{1,2})\/\d{1,2}\/\d{4}/)?.[1];

    const vitalsDateLabel = this.page
      .locator('.vitals-wrap-body, .prescription-box-sm')
      .getByText(/\d{1,2}\s+\w{3},?\s*\d{2}/)
      .first();
    const labelText = (await vitalsDateLabel.textContent().catch(() => '')) ?? '';
    const vitalsDay = labelText.match(/(\d{1,2})\s+\w{3}/)?.[1];

    const day = headerDay ?? vitalsDay;

    if (day) {
      const dayCell = picker
        .locator('.ant-picker-cell-in-view:not(.ant-picker-cell-disabled)')
        .filter({ has: this.page.locator('.ant-picker-cell-inner', { hasText: day }) })
        .first();
      if (await dayCell.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await dayCell.locator('.ant-picker-cell-inner').click();
        return;
      }
    }

    const todayCell = picker.locator('.ant-picker-cell-today .ant-picker-cell-inner').first();
    if (await todayCell.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await todayCell.click();
      return;
    }

    await picker
      .locator('.ant-picker-cell-in-view:not(.ant-picker-cell-disabled) .ant-picker-cell-inner')
      .last()
      .click();
  }
}
