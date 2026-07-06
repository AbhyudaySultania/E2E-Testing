import { expect, type Locator, type Page } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { patientQueueRow } from '../helpers/patient-locator';
import { consultMenuItem } from '../helpers/test-id-locator';
import { purgeUiBlockers } from '../helpers/premium-popup-guard';
import { purgeInterceptorsOnly } from '../helpers/ui-blocker-guard';
import { AppShellPage } from './app-shell.page';

export class AppointmentQueuePage {
  private readonly appShell: AppShellPage;

  constructor(private readonly page: Page) {
    this.appShell = new AppShellPage(page);
  }

  async gotoDashboardQueue() {
    const dashboardUrl = REGRESSION_TEST_DATA.routes.dashboard;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
        break;
      } catch (error) {
        if (attempt === 1 || !String(error).includes('ERR_ABORTED')) {
          throw error;
        }
        await this.page.waitForTimeout(500);
      }
    }

    await this.appShell.dismissBlockingOverlays('queue-dashboard');
    await expect(this.page).toHaveURL(new RegExp(`${dashboardUrl}$`), {
      timeout: 15_000,
    });

    const queueTab = this.page.getByRole('tab', { name: /queue/i }).first();
    if (await queueTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await queueTab.click();
    }
  }

  private appointmentRow(patientName: string, mobile: string) {
    return patientQueueRow(this.page, patientName, mobile);
  }

  private async searchQueuePatient(patientName: string, mobile: string) {
    const search = this.page.getByPlaceholder(/search patient by name and mobile/i);
    await expect(search).toBeVisible({ timeout: 5_000 });
    await search.click({ clickCount: 3 });
    await search.fill(patientName);
    await this.page.waitForTimeout(1_200);

    const row = this.appointmentRow(patientName, mobile);
    if (await row.isVisible({ timeout: 2_000 }).catch(() => false)) {
      return;
    }

    await search.click({ clickCount: 3 });
    await search.fill(mobile);
    await this.page.waitForTimeout(1_200);
  }

  private async clearQueueSearch() {
    const search = this.page.getByPlaceholder(/search patient by name and mobile/i);
    if (await search.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await search.click({ clickCount: 3 });
      await search.fill('');
      await this.page.waitForTimeout(400);
    }
  }

  private async setQueueDateViaCalendar(ddMmYyyy: string) {
    const [dd, mm, yyyy] = ddMmYyyy.split('-').map((part) => Number(part));
    const target = new Date(yyyy, mm - 1, dd);

    const dateInput = this.page.getByPlaceholder(/dd-mm-yyyy/i);
    if (!(await dateInput.isVisible({ timeout: 3_000 }).catch(() => false))) {
      return;
    }

    await dateInput.click();
    const calendar = this.page.locator(
      '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
    );
    await expect(calendar).toBeVisible({ timeout: 5_000 });

    const targetMonth = target.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    for (let step = 0; step < 14; step++) {
      const header = await calendar.locator('.ant-picker-header-view').innerText();
      if (header.includes(targetMonth) || header.includes(String(yyyy))) {
        break;
      }
      const nextMonth = calendar.locator('.ant-picker-header-next-btn');
      if (await nextMonth.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextMonth.click();
      } else {
        break;
      }
    }

    const dayCell = calendar
      .locator('.ant-picker-cell-in-view')
      .getByText(String(dd), { exact: true })
      .first();
    await dayCell.click();
    await this.page.waitForTimeout(1_200);
  }

  private async scanDatesForPatient(
    patientName: string,
    mobile: string,
    bookedDate?: string,
  ) {
    if (bookedDate) {
      await this.setQueueDateViaCalendar(bookedDate);
      await this.searchQueuePatient(patientName, mobile);
      const bookedRow = this.appointmentRow(patientName, mobile);
      if (await bookedRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
        return bookedRow;
      }
      await this.clearQueueSearch();
    }

    await this.searchQueuePatient(patientName, mobile);
    const row = this.appointmentRow(patientName, mobile);
    if (await row.isVisible({ timeout: 5_000 }).catch(() => false)) {
      return row;
    }
    await this.clearQueueSearch();

    const forward = this.page.locator('.appointment-date-group').getByRole('button').last();
    for (let day = 0; day < 14; day++) {
      if (!(await forward.isEnabled({ timeout: 1_000 }).catch(() => false))) {
        break;
      }

      await forward.click();
      await this.page.waitForTimeout(1_200);
      await this.searchQueuePatient(patientName, mobile);

      if (await row.isVisible({ timeout: 3_000 }).catch(() => false)) {
        return row;
      }
      await this.clearQueueSearch();
    }

    return row;
  }

  /** Poll until the just-booked appointment appears (queue API can lag after book). */
  private async waitForPatientQueueRow(
    patientName: string,
    mobile: string,
    bookedDate?: string,
  ) {
    let row = this.appointmentRow(patientName, mobile);

    await expect(async () => {
      row = await this.scanDatesForPatient(patientName, mobile, bookedDate);
      await expect(row).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 3_000] });

    return row;
  }

  /** Queue rows use virtualized DOM — click Consult/caret inside the row via evaluate. */
  private async clickConsultOnQueueRow(
    row: Locator,
  ): Promise<'consult' | 'caret' | false> {
    return row.evaluate((el) => {
      const queueConsult = el.querySelector('[data-testid="rx-queue-consult"]');
      if (queueConsult instanceof HTMLElement) {
        queueConsult.click();
        return 'consult';
      }

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

  private async clickConsultInAntDropdown() {
    await purgeInterceptorsOnly(this.page, 'queue-consult-menu');

    const menuConsult = consultMenuItem(this.page);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (await menuConsult.isVisible({ timeout: 4_000 }).catch(() => false)) {
        await menuConsult.dispatchEvent('click');
        return;
      }
      await this.page.waitForTimeout(400);
    }

    await expect(menuConsult).toBeVisible({ timeout: 8_000 });
    await menuConsult.dispatchEvent('click');
  }

  async startConsultForPatient(
    patientName: string,
    mobile: string,
    bookedDate?: string,
  ) {
    await purgeUiBlockers(this.page);
    await this.appShell.dismissBlockingOverlays('queue-start-consult');

    const appointmentRow = await this.waitForPatientQueueRow(
      patientName,
      mobile,
      bookedDate,
    );

    const prescriptionNav = this.page.waitForURL(
      new RegExp(`${REGRESSION_TEST_DATA.routes.prescription}$`),
      { timeout: 30_000 },
    );

    const consultClick = await this.clickConsultOnQueueRow(appointmentRow);
    if (consultClick === 'consult') {
      await prescriptionNav;
      return;
    }

    if (consultClick === 'caret') {
      try {
        await this.clickConsultInAntDropdown();
        await prescriptionNav;
        return;
      } catch {
        await this.clickConsultOnQueueRow(appointmentRow);
        await this.clickConsultInAntDropdown();
        await prescriptionNav;
        return;
      }
    }

    const splitButton = appointmentRow.locator('.btn-smart-rx-walkin').first();
    if (await splitButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const caret = splitButton.locator('.consult-btns-group a').first();
      await caret.dispatchEvent('click');
      await this.clickConsultInAntDropdown();
      await prescriptionNav;
      return;
    }

    throw new Error(
      `Consult action not found for queued patient: ${patientName} (${mobile})`,
    );
  }
}
