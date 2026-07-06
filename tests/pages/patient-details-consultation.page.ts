import { expect, type Page } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { clickResilient, dismissKnownBlockers } from '../helpers/ui-blocker-guard';
import { AllPatientsPage } from './all-patients.page';
import { AppShellPage } from './app-shell.page';

export class PatientDetailsConsultationPage {
  private readonly appShell: AppShellPage;
  private readonly allPatients: AllPatientsPage;

  constructor(private readonly page: Page) {
    this.appShell = new AppShellPage(page);
    this.allPatients = new AllPatientsPage(page);
  }

  async openPatientDetails() {
    const { patient } = REGRESSION_TEST_DATA;
    await dismissKnownBlockers(this.page, 'open-patient-details');
    await this.allPatients.goto();
    await this.allPatients.openPatientDetails(patient.fullName, patient.mobile);
    await expect(this.page).toHaveURL(
      new RegExp(`${REGRESSION_TEST_DATA.routes.patientDetails}$`),
    );
  }

  async ensureConsultationByTcmId(tcmId: number) {
    await this.appShell.dismissBlockingOverlays('ensure-consultation');
    await this.goToConsultationIndex(1);

    const matched = await this.waitForConsultationTcmId(tcmId, 60);
    expect(matched, `Consultation tcm_id ${tcmId} should be selectable`).toBe(true);
  }

  private consultationPagerText() {
    return this.page.getByText(/\d+\s*\/\s*\d+/).first();
  }

  private async currentPagerIndex(): Promise<number | null> {
    if (!(await this.consultationPagerText().isVisible({ timeout: 3_000 }).catch(() => false))) {
      return null;
    }
    const text = (await this.consultationPagerText().innerText()).trim();
    const match = text.match(/^(\d+)/);
    return match ? Number(match[1]) : null;
  }

  private consultationPrevButton() {
    return this.page
      .locator('button')
      .filter({ has: this.page.locator('.iconrotate180, .icon-left') })
      .filter({ hasNotText: /consult|repeat|rx/i })
      .first();
  }

  private consultationNextButton() {
    return this.page
      .locator('button')
      .filter({ has: this.page.locator('.icon-right') })
      .filter({ hasNotText: /consult|repeat|rx/i })
      .last();
  }

  private async pagerBounds(): Promise<{ current: number; total: number } | null> {
    if (!(await this.consultationPagerText().isVisible({ timeout: 3_000 }).catch(() => false))) {
      return null;
    }
    const text = (await this.consultationPagerText().innerText()).trim();
    const match = text.match(/^(\d+)\s*\/\s*(\d+)/);
    if (!match) return null;
    return { current: Number(match[1]), total: Number(match[2]) };
  }

  /** Carousel often opens mid-history (e.g. 12/194); newest visit is index 1 (newest-first API). */
  private async goToConsultationIndex(targetIndex: number) {
    for (let step = 0; step < 220; step++) {
      const bounds = await this.pagerBounds();
      if (!bounds || bounds.current === targetIndex) return;
      const button =
        bounds.current > targetIndex
          ? this.consultationPrevButton()
          : this.consultationNextButton();
      if (!(await button.isVisible({ timeout: 500 }).catch(() => false))) return;
      await clickResilient(this.page, button, { label: 'consultation-carousel' });
      await this.page.waitForTimeout(400);
    }
  }

  private async waitForConsultationTcmId(tcmId: number, maxSteps: number) {
    for (let step = 0; step < maxSteps; step++) {
      const current = await this.currentConsultationTcmId();
      if (current === tcmId) return true;

      if (step === 0 && current === null) {
        await this.page.waitForTimeout(1_000);
        continue;
      }

      const nextButton = this.consultationNextButton();
      if (await nextButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await clickResilient(this.page, nextButton, { label: 'consultation-next' });
        await this.page.waitForTimeout(600);
        continue;
      }

      const prevButton = this.consultationPrevButton();
      if (await prevButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await clickResilient(this.page, prevButton, { label: 'consultation-prev' });
        await this.page.waitForTimeout(600);
      }
    }

    return (await this.currentConsultationTcmId()) === tcmId;
  }

  private async currentConsultationTcmId(): Promise<number | null> {
    const response = await this.page
      .waitForResponse(
        (res) =>
          res.url().includes(REGRESSION_TEST_DATA.api.viewCaseManager) &&
          res.request().method() === 'POST' &&
          res.status() === 200,
        { timeout: 8_000 },
      )
      .catch(() => null);

    if (!response) return null;

    const body = await response.json();
    const record = body as Record<string, unknown>;
    const data = (record.data as Record<string, unknown> | undefined) ?? record;
    const parsed = Number(data.tcm_id ?? data.tcmId);
    return parsed > 0 ? parsed : null;
  }

  async clickRepeatRx() {
    await this.appShell.dismissBlockingOverlays('repeat-rx');

    const repeatButton = this.page.getByRole('button', { name: /repeat.*rx/i }).first();
    await expect(repeatButton).toBeVisible({ timeout: 15_000 });

    const prescriptionNav = this.page.waitForURL(
      new RegExp(`${REGRESSION_TEST_DATA.routes.prescription}$`),
      { timeout: 30_000 },
    );

    await clickResilient(this.page, repeatButton, { label: 'repeat-rx' });
    await prescriptionNav;
  }
}
