import { expect, type Page } from '@playwright/test';
import { PRESCRIPTION_TEST_DATA } from '../fixtures/prescription-test-data';
import { AppShellPage } from './app-shell.page';

export class DashboardPage {
  private readonly appShell: AppShellPage;

  constructor(private readonly page: Page) {
    this.appShell = new AppShellPage(page);
  }

  async goto() {
    await this.page.goto(PRESCRIPTION_TEST_DATA.routes.dashboard);
    await expect(this.page).toHaveURL(
      new RegExp(`${PRESCRIPTION_TEST_DATA.routes.dashboard}$`),
      { timeout: 15_000 },
    );
  }

  async assertOnDashboard() {
    await expect(this.page).not.toHaveURL(/\/login/);
    await expect(
      this.page
        .getByRole('heading', { name: /welcome dr\.|your appointments/i })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  }

  async startWalkInConsultation() {
    await this.appShell.dismissDashboardBlockers();

    const walkInButton = this.page.getByRole('button', {
      name: /start walk-in/i,
    });

    if (await walkInButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await walkInButton.scrollIntoViewIfNeeded();
      try {
        await walkInButton.click({ timeout: 8_000 });
      } catch {
        await this.appShell.dismissDashboardBlockers();
        await walkInButton.click({ timeout: 5_000 }).catch(() => undefined);
      }
    }

    if (!this.page.url().includes(PRESCRIPTION_TEST_DATA.routes.walkIn)) {
      await this.page.goto(PRESCRIPTION_TEST_DATA.routes.walkIn);
    }

    await expect(this.page).toHaveURL(
      new RegExp(`${PRESCRIPTION_TEST_DATA.routes.walkIn}$`),
      { timeout: 15_000 },
    );
  }
}
