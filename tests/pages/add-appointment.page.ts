import { expect, type Locator, type Page } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { patientSearchOption } from '../helpers/patient-locator';
import { clickResilient, purgeInterceptorsOnly } from '../helpers/ui-blocker-guard';
import { AppShellPage } from './app-shell.page';

export class AddAppointmentPage {
  private readonly appShell: AppShellPage;
  private bookedQueueDate?: string;

  constructor(private readonly page: Page) {
    this.appShell = new AppShellPage(page);
  }

  getBookedQueueDate(): string | undefined {
    return this.bookedQueueDate;
  }

  /** Parse "13th Jun 2026" from confirm drawer → dashboard date picker format dd-mm-yyyy */
  private async captureBookedQueueDate(drawer: Locator) {
    const drawerText = await drawer.innerText();
    const match = drawerText.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
    if (!match) {
      return;
    }

    const day = Number(match[1]);
    const month = match[2];
    const year = Number(match[3]);
    const parsed = new Date(`${month} ${day}, ${year}`);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    this.bookedQueueDate = `${dd}-${mm}-${year}`;
  }

  async goto() {
    await this.page.goto(REGRESSION_TEST_DATA.routes.addAppointment);
    await expect(this.page).toHaveURL(
      new RegExp(`${REGRESSION_TEST_DATA.routes.addAppointment}$`),
      { timeout: 15_000 },
    );
    await expect(
      this.page.getByRole('heading', { name: /select an appointment slot/i }),
    ).toBeVisible({ timeout: 15_000 });
    await this.appShell.dismissBlockingOverlays();
  }

  private async waitForSlots() {
    await this.page.waitForResponse(
      (res) =>
        res.url().includes(REGRESSION_TEST_DATA.api.listSlots) &&
        res.request().method() === 'GET' &&
        res.status() === 200,
      { timeout: 25_000 },
    ).catch(() => undefined);
  }

  private futureAvailableSlots() {
    return this.page.locator('.slot.available:not(.past)');
  }

  private confirmAppointmentDrawer() {
    return this.page
      .locator('.ant-drawer.ant-drawer-open')
      .filter({ hasText: /confirm appointment/i });
  }

  private async activatePatientSearch(patientSearch: Locator) {
    await patientSearch.scrollIntoViewIfNeeded();
    await patientSearch.evaluate((el) => {
      const input = el as HTMLInputElement;
      input.focus();
      input.click();
    });
  }

  private async activateTimeTab(tabName: RegExp) {
    const tab = this.page.getByRole('tab', { name: tabName }).first();
    if (await tab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await tab.click();
      await this.page.waitForTimeout(400);
    }
  }

  async selectEarliestAvailableSlot() {
    await this.waitForSlots();
    await this.appShell.dismissBlockingOverlays();

    const timeTabs = [/evening/i, /night/i, /morning/i, /afternoon/i];
    const dateChips = this.page.locator('.date-chip');
    const chipCount = await dateChips.count();

    for (let chipIndex = 0; chipIndex < Math.max(chipCount, 1); chipIndex++) {
      if (chipIndex > 0) {
        await dateChips.nth(chipIndex).click();
        await this.waitForSlots();
      }

      for (const tabPattern of timeTabs) {
        await this.activateTimeTab(tabPattern);
        await this.appShell.dismissBlockingOverlays();

        const slots = this.futureAvailableSlots();
        const slotCount = await slots.count();
        if (slotCount === 0) {
          continue;
        }

        const confirmDrawer = this.confirmAppointmentDrawer();

        for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
          const slot = slots.nth(slotIndex);
          if (!(await slot.isVisible({ timeout: 1_000 }).catch(() => false))) {
            continue;
          }

          await this.appShell.dismissBlockingOverlays();
          await slot.click({ force: true });
          await this.appShell.dismissPastTimeSlotPopover();

          if (await confirmDrawer.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await expect(
              confirmDrawer.getByRole('button', { name: /book appointment/i }),
            ).toBeVisible({ timeout: 10_000 });
            return;
          }

          await this.appShell.dismissPastTimeSlotPopover();
        }
      }
    }

    throw new Error(
      'No future available appointment slot found for today or upcoming date chips',
    );
  }

  async fillConfirmDrawerAndBook(
    patientQuery: string,
    patientName: string,
    mobile: string,
  ) {
    await purgeInterceptorsOnly(this.page, 'confirm-drawer');

    const drawer = this.confirmAppointmentDrawer();
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await drawer.locator('.ant-drawer-body').scrollIntoViewIfNeeded();

    const alreadySelected = drawer
      .locator('.border, .selected-patient, .patient-selected')
      .filter({ hasText: patientName })
      .filter({ hasText: mobile });
    const patientPreFilled = await alreadySelected
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    if (!patientPreFilled) {
      const patientSearch = drawer.getByPlaceholder(
        /search by patient.*name.*phone|mobile/i,
      );
      await expect(patientSearch).toBeVisible({ timeout: 10_000 });
      await this.activatePatientSearch(patientSearch);
      await patientSearch.fill('');
      await patientSearch.pressSequentially(patientQuery, { delay: 40 });

      await this.page.waitForResponse(
        (res) =>
          res.url().includes(REGRESSION_TEST_DATA.api.searchPatient) &&
          res.request().method() === 'POST' &&
          res.status() === 200,
        { timeout: 15_000 },
      ).catch(() => undefined);

      const dropdown = this.page.locator(
        '.ant-select-dropdown.walkincomplete:not(.ant-select-dropdown-hidden)',
      );

      if (!(await dropdown.isVisible({ timeout: 5_000 }).catch(() => false))) {
        await this.activatePatientSearch(patientSearch);
        await this.page.keyboard.press('ArrowDown');
      }

      await expect(dropdown).toBeVisible({ timeout: 10_000 });

      const patientOption = patientSearchOption(dropdown, patientName, mobile);
      if (await patientOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await patientOption.click();
      } else {
        const byName = dropdown
          .locator('.list-patientName, .ant-select-item-option')
          .filter({ hasText: patientName })
          .first();
        await expect(byName).toBeVisible({ timeout: 10_000 });
        await byName.click();
      }
    }

    const caseTypeSelect = drawer.locator('.ant-select').first();
    if (await caseTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await caseTypeSelect.click();
      const opdOption = this.page
        .locator('.ant-select-item-option')
        .filter({ hasText: /opd|normal|consultation/i })
        .first();
      if (await opdOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await opdOption.click();
      } else {
        await this.page.locator('.ant-select-item-option').first().click();
      }
    }

    await this.captureBookedQueueDate(drawer);

    const bookResponse = this.page.waitForResponse(
      (res) =>
        res.url().includes(REGRESSION_TEST_DATA.api.addAppointment) &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 30_000 },
    );

    await purgeInterceptorsOnly(this.page, 'book-appointment');
    const bookButton = drawer.getByRole('button', { name: /book appointment/i });
    await clickResilient(this.page, bookButton, { label: 'book-appointment' });
    const response = await bookResponse;
    const body = (await response.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
    };
    if (body.status === false) {
      throw new Error(`Book appointment API failed: ${body.message ?? 'unknown error'}`);
    }

    await expect(this.page.getByText(/appointment booked successfully/i)).toBeVisible({
      timeout: 15_000,
    });
    await this.page.waitForTimeout(1_500);
    await this.appShell.dismissBlockingOverlays();
  }
}
