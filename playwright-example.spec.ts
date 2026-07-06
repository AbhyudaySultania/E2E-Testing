/**
 * Playwright + Cursor/Claude Code Generated Tests
 *
 * Framework: Playwright with AI-assisted generation via Cursor MCP and Test Agents
 * Target Application: rx-pad 1.0
 *
 * Setup:
 *   npm init playwright@latest
 *   npx playwright init-agents --loop=vscode
 *   Configure Playwright MCP in Cursor settings
 *
 * Generation workflow:
 *   1. Planner Agent → specs/prescription-happy-path.md
 *   2. Generator Agent → this test file
 *   3. Healer Agent → repairs broken locators post-UI-change
 */

import { test, expect } from '@playwright/test';

const RX_PAD_BASE_URL = process.env.RX_PAD_BASE_URL ?? 'TODO_BASE_URL';
const TEST_USERNAME = process.env.RX_PAD_USERNAME ?? 'TODO_USERNAME';
const TEST_PASSWORD = process.env.RX_PAD_PASSWORD ?? 'TODO_PASSWORD';

test.describe('rx-pad 1.0 — Prescription Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RX_PAD_BASE_URL);
  });

  test('should create and save a prescription with all mandatory fields', async ({
    page,
  }) => {
    // Step 1: Login if required
    const loginForm = page.locator('[data-testid="login-form"]');
    if (await loginForm.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByLabel('Username').fill(TEST_USERNAME);
      await page.getByLabel('Password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Login' }).click();
      await expect(page).not.toHaveURL(/login/);
    }

    // Step 2: Open prescription form
    await page.getByRole('link', { name: 'Prescriptions' }).click();
    await page.getByRole('button', { name: 'New Prescription' }).click();
    await expect(
      page.getByRole('heading', { name: /prescription/i }),
    ).toBeVisible();

    // Step 3: Populate mandatory fields
    // TODO: Replace selectors once rx-pad data-testid attributes are confirmed
    await page
      .getByTestId('prescription-patient-name')
      .or(page.getByLabel('Patient Name'))
      .fill('TODO_PATIENT_NAME');

    await page
      .getByTestId('prescription-doctor-name')
      .or(page.getByLabel('Doctor Name'))
      .fill('TODO_DOCTOR_NAME');

    await page
      .getByTestId('prescription-date')
      .or(page.getByLabel('Date'))
      .fill('TODO_PRESCRIPTION_DATE');

    await page
      .getByTestId('prescription-medication-0')
      .or(page.getByLabel('Medication'))
      .fill('TODO_MEDICATION_FIELD');

    await page
      .getByTestId('prescription-dosage-0')
      .or(page.getByLabel('Dosage'))
      .fill('TODO_DOSAGE_FIELD');

    await page
      .getByTestId('prescription-frequency-0')
      .or(page.getByLabel('Frequency'))
      .fill('TODO_FREQUENCY_FIELD');

    await page
      .getByTestId('prescription-duration-0')
      .or(page.getByLabel('Duration'))
      .fill('TODO_DURATION_FIELD');

    // Step 4: Save prescription
    await page
      .getByTestId('prescription-save-btn')
      .or(page.getByRole('button', { name: 'Save' }))
      .click();

    // Step 5: Verify successful completion
    await expect(
      page.getByText(/prescription saved successfully/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should print a saved prescription', async ({ page }) => {
    // Login (reuse pattern — in production, extract to seed.spec.ts)
    const loginForm = page.locator('[data-testid="login-form"]');
    if (await loginForm.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByLabel('Username').fill(TEST_USERNAME);
      await page.getByLabel('Password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Login' }).click();
    }

    await page.getByRole('link', { name: 'Prescriptions' }).click();
    await page.getByRole('row', { name: /TODO_PATIENT_NAME/ }).click();

    const printPromise = page.waitForEvent('popup');
    await page
      .getByTestId('prescription-print-btn')
      .or(page.getByRole('button', { name: 'Print' }))
      .click();

    const printPage = await printPromise;
    await expect(printPage.getByText(/TODO_PATIENT_NAME/)).toBeVisible();
  });

  test('should show validation errors for empty mandatory fields', async ({
    page,
  }) => {
    const loginForm = page.locator('[data-testid="login-form"]');
    if (await loginForm.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByLabel('Username').fill(TEST_USERNAME);
      await page.getByLabel('Password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Login' }).click();
    }

    await page.getByRole('link', { name: 'Prescriptions' }).click();
    await page.getByRole('button', { name: 'New Prescription' }).click();

    await page
      .getByTestId('prescription-save-btn')
      .or(page.getByRole('button', { name: 'Save' }))
      .click();

    await expect(page.getByText(/patient name is required/i)).toBeVisible();
    await expect(page.getByText(/medication is required/i)).toBeVisible();
  });
});
