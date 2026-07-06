import { expect, type Page } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { RX_TEST_IDS } from '../fixtures/test-ids';
import { consultMenuItem, consultSplitTrigger } from '../helpers/test-id-locator';
import { purgeUiBlockers } from '../helpers/premium-popup-guard';
import { AppShellPage } from './app-shell.page';

export class PatientDetailsPage {
  private readonly appShell: AppShellPage;

  constructor(private readonly page: Page) {
    this.appShell = new AppShellPage(page);
  }

  async assertOnPatientDetails(patientName: string) {
    await expect(this.page).toHaveURL(
      new RegExp(`${REGRESSION_TEST_DATA.routes.patientDetails}$`),
      { timeout: 15_000 },
    );
    await expect(this.page.getByText(patientName, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
  }

  private async clickConsultInSmartRxDropdown() {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();

    const menuConsult = consultMenuItem(this.page);
    await expect(menuConsult).toBeVisible({ timeout: 8_000 });
    await menuConsult.dispatchEvent('click');
  }

  private async clickConsultViaSmartRxSplit() {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();

    const splitButton = this.page.locator('.btn-smart-rx-walkin').first();
    await expect(splitButton).toBeVisible({ timeout: 8_000 });

    const consultPrimary = splitButton
      .getByTestId(RX_TEST_IDS.CONSULT_PRIMARY)
      .or(splitButton.getByRole('button', { name: /^consult$/i }));
    if (await consultPrimary.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await consultPrimary.click({ force: true });
      return;
    }

    const caret = consultSplitTrigger(splitButton);
    await caret.click({ force: true });
    await this.clickConsultInSmartRxDropdown();
  }

  async startConsult() {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays();

    const prescriptionNav = this.page.waitForURL(
      new RegExp(`${REGRESSION_TEST_DATA.routes.prescription}$`),
      { timeout: 25_000 },
    );

    const consultButton = this.page
      .getByTestId(RX_TEST_IDS.PATIENT_DETAILS_CONSULT)
      .or(this.page.getByRole('button', { name: /^consult$/i }))
      .first();
    if (await consultButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await consultButton.click({ force: true });
      await prescriptionNav;
      return;
    }

    const startNewVisit = this.page
      .getByRole('button', { name: /start new visit/i })
      .first();
    if (await startNewVisit.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await startNewVisit.click({ force: true });
      await prescriptionNav;
      return;
    }

    if (await this.page.locator('.btn-smart-rx-walkin').first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.clickConsultViaSmartRxSplit();
      await prescriptionNav;
      return;
    }

    await this.clickConsultViaSmartRxSplit();
    await prescriptionNav;
  }
}
