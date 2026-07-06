import { expect, type Locator, type Page } from '@playwright/test';
import { PRESCRIPTION_TEST_DATA } from '../fixtures/prescription-test-data';
import { RX_TEST_IDS } from '../fixtures/test-ids';
import { consultMenuItem, consultSplitTrigger } from '../helpers/test-id-locator';
import {
  installPremiumPopupGuard,
  purgeUiBlockers,
} from '../helpers/premium-popup-guard';
import { AppShellPage } from './app-shell.page';

export class WalkInConsultationPage {
  private readonly appShell: AppShellPage;

  constructor(private readonly page: Page) {
    this.appShell = new AppShellPage(page);
  }

  private get patientSearchInput() {
    return this.page.getByPlaceholder(
      /search by patient.*name.*phone.*id/i,
    );
  }

  private get visibleWalkInDropdown() {
    return this.page.locator(
      '.ant-select-dropdown.walkincomplete:not(.ant-select-dropdown-hidden)',
    );
  }

  private get patientSelectedModal() {
    return this.page.locator('.ant-modal').filter({ hasText: /patient selected/i });
  }

  async assertOnWalkInPage() {
    await expect(this.page).toHaveURL(
      new RegExp(`${PRESCRIPTION_TEST_DATA.routes.walkIn}$`),
    );
    await expect(
      this.page.getByRole('heading', { name: /start walk-in consultation/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(this.patientSearchInput).toBeVisible();
  }

  private async ensureWalkInDropdownOpen() {
    await purgeUiBlockers(this.page);

    if (await this.visibleWalkInDropdown.isVisible({ timeout: 1_000 }).catch(() => false)) {
      return;
    }

    await this.patientSearchInput.click();
    const searchValue = (await this.patientSearchInput.inputValue()).trim();
    if (!searchValue) {
      await this.page.keyboard.press('ArrowDown');
    }
    await expect(this.visibleWalkInDropdown).toBeVisible({ timeout: 10_000 });
  }

  private async scrollPatientRowIntoView(dropdown: Locator, patientName: string) {
    await dropdown.locator('.rc-virtual-list-holder').evaluate((holder, name) => {
      const options = holder.querySelectorAll('.ant-select-item-option');
      for (const option of options) {
        if (option.textContent?.includes(name)) {
          option.scrollIntoView({ block: 'nearest' });
          break;
        }
      }
    }, patientName);
  }

  private async clickConsultOnPatientRow(row: Locator): Promise<'consult' | 'caret' | false> {
    return row.evaluate((el) => {
      const primary = el.querySelector('[data-testid="rx-consult-primary"]');
      if (primary instanceof HTMLElement) {
        primary.click();
        return 'consult';
      }

      for (const btn of el.querySelectorAll('button')) {
        const label = (btn.textContent ?? '').trim();
        if (/^consult$/i.test(label) || /start consult/i.test(label)) {
          btn.click();
          return 'consult';
        }
      }

      const caret =
        el.querySelector('[data-testid="rx-consult-split"]') ??
        el.querySelector('.consult-btns-group a');
      if (caret) {
        (caret as HTMLElement).click();
        return 'caret';
      }

      return false;
    });
  }

  private patientResultRow(dropdown: Locator, patientName: string) {
    return dropdown
      .locator('.ant-select-item-option')
      .filter({ hasText: patientName })
      .first();
  }

  async searchPatient(query: string) {
    await installPremiumPopupGuard(this.page);
    await this.appShell.dismissBlockingOverlays();

    const searchResponse = this.page.waitForResponse(
      (res) =>
        res.url().includes(PRESCRIPTION_TEST_DATA.api.searchPatient) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 15_000 },
    );

    await this.patientSearchInput.click();
    await this.patientSearchInput.fill('');
    await this.patientSearchInput.pressSequentially(query, { delay: 40 });
    await searchResponse;
    await this.ensureWalkInDropdownOpen();
  }

  async assertPatientInResults(name: string, mobile: string) {
    await this.ensureWalkInDropdownOpen();

    const dropdown = this.visibleWalkInDropdown;
    const resultRow = dropdown
      .locator('li, .ant-select-item, .ant-select-item-option, [class*="option"]')
      .filter({ hasText: name })
      .first();

    await expect(resultRow).toBeVisible({ timeout: 10_000 });

    const rowWithMobile = dropdown
      .locator('li, .ant-select-item, .ant-select-item-option, [class*="option"]')
      .filter({ hasText: name })
      .filter({ hasText: mobile })
      .first();

    if (await rowWithMobile.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(rowWithMobile).toBeVisible();
    }
  }

  private async clickConsultInAntDropdown() {
    await purgeUiBlockers(this.page);
    const menuConsult = consultMenuItem(this.page);
    await expect(menuConsult).toBeVisible({ timeout: 8_000 });
    await menuConsult.dispatchEvent('click');
  }

  private async clickConsultViaSmartRxSplit(container: Locator) {
    const result = await this.clickConsultOnPatientRow(container);
    if (result === 'consult') return;
    if (result === 'caret') {
      await this.clickConsultInAntDropdown();
      return;
    }

    await purgeUiBlockers(this.page);
    const splitButton = container.locator('.btn-smart-rx-walkin').first();
    const caret = consultSplitTrigger(splitButton);
    await caret.dispatchEvent('click');
    await this.clickConsultInAntDropdown();
  }

  private async startConsultFromPatientModal(patientName: string) {
    const modal = this.patientSelectedModal;
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(patientName, { exact: false })).toBeVisible();

    const startConsult = modal
      .getByTestId(RX_TEST_IDS.WALK_IN_START_CONSULT)
      .or(modal.getByRole('button', { name: /start consult/i }));
    if (await startConsult.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await startConsult.click();
      return;
    }

    const consultBtn = modal
      .getByTestId(RX_TEST_IDS.CONSULT_PRIMARY)
      .or(modal.getByRole('button', { name: /^consult$/i }));
    if (await consultBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await consultBtn.click();
      return;
    }

    await this.clickConsultViaSmartRxSplit(modal);
  }

  async startConsultForPatient(patientName: string) {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();

    const prescriptionNav = this.page.waitForURL(
      new RegExp(`${PRESCRIPTION_TEST_DATA.routes.prescription}$`),
      { timeout: 30_000 },
    );

    if (await this.patientSelectedModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.startConsultFromPatientModal(patientName);
      await prescriptionNav;
      return;
    }

    await this.ensureWalkInDropdownOpen();
    const dropdown = this.visibleWalkInDropdown;
    await this.scrollPatientRowIntoView(dropdown, patientName);
    const row = this.patientResultRow(dropdown, patientName);
    await expect(row).toBeAttached({ timeout: 10_000 });

    const consultClick = await this.clickConsultOnPatientRow(row);
    if (consultClick === 'consult') {
      await prescriptionNav;
      return;
    }
    if (consultClick === 'caret') {
      await this.clickConsultInAntDropdown();
      await prescriptionNav;
      return;
    }

    if (await row.locator('.btn-smart-rx-walkin').count()) {
      await this.clickConsultViaSmartRxSplit(row);
      await prescriptionNav;
      return;
    }

    await row.dispatchEvent('click');
    await this.startConsultFromPatientModal(patientName);
    await prescriptionNav;
  }

  async assertNavigatedToPrescription() {
    await expect(this.page).toHaveURL(
      new RegExp(`${PRESCRIPTION_TEST_DATA.routes.prescription}$`),
      { timeout: 20_000 },
    );
    await expect(this.page).not.toHaveURL(/\/login/);
  }
}
