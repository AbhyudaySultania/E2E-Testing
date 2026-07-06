import { expect, type Page } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { AppShellPage } from './app-shell.page';

export class AllPatientsPage {
  private readonly appShell: AppShellPage;

  constructor(private readonly page: Page) {
    this.appShell = new AppShellPage(page);
  }

  private get searchInput() {
    return this.page.getByPlaceholder(/search by patient name.*id.*mobile/i);
  }

  async goto() {
    await this.page.goto(REGRESSION_TEST_DATA.routes.allPatients);
    await expect(this.page).toHaveURL(
      new RegExp(`${REGRESSION_TEST_DATA.routes.allPatients}$`),
      { timeout: 15_000 },
    );
    await expect(this.page.getByRole('heading', { name: /all patients/i })).toBeVisible({
      timeout: 15_000 },
    );
    await this.appShell.dismissPremiumPopup();
  }

  async searchPatient(query: string) {
    await this.appShell.dismissPremiumPopup();

    const listResponse = this.page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/patient/listDashboard') &&
        res.request().method() === 'GET' &&
        res.status() === 200,
      { timeout: 20_000 },
    );

    await this.searchInput.click();
    await this.searchInput.fill('');
    await this.searchInput.pressSequentially(query, { delay: 40 });
    await listResponse.catch(async () => {
      await this.page.waitForTimeout(700);
    });
  }

  async openPatientDetails(patientName: string, mobile: string) {
    await this.appShell.dismissPremiumPopup();

    const patientDetailsNav = this.page.waitForURL(
      new RegExp(`${REGRESSION_TEST_DATA.routes.patientDetails}$`),
      { timeout: 25_000 },
    );

    let row = this.page.getByRole('row').filter({ hasText: mobile }).filter({ hasText: patientName });
    if (!(await row.first().isVisible({ timeout: 4_000 }).catch(() => false))) {
      await this.searchPatient(mobile);
      row = this.page.getByRole('row').filter({ hasText: mobile }).filter({ hasText: patientName });
    }

    await expect(row.first()).toBeVisible({ timeout: 15_000 });

    const nameLink = row
      .first()
      .locator('span.text-primary, .text-primary, [class*="cursor-pointer"]')
      .filter({ hasText: patientName })
      .first();

    if (await nameLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nameLink.click();
    } else {
      await row.getByText(patientName, { exact: false }).first().click();
    }

    await patientDetailsNav;
    await this.appShell.dismissPremiumPopup();
  }
}
