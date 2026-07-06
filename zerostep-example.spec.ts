/**
 * ZeroStep + Playwright — Runtime Natural Language Testing
 *
 * Framework: ZeroStep AI layer on Playwright
 * Target Application: rx-pad 1.0
 *
 * Setup:
 *   npm install @playwright/test @zerostep/playwright
 *   export ZEROSTEP_TOKEN="your-token-here"
 *
 * ZeroStep resolves actions at runtime via AI — no CSS/XPath selectors needed.
 * Ideal for brittle prescription form fields that change frequently.
 */

import { test, expect } from '@playwright/test';
import { ai } from '@zerostep/playwright';

const RX_PAD_BASE_URL = process.env.RX_PAD_BASE_URL ?? 'TODO_BASE_URL';
const TEST_USERNAME = process.env.RX_PAD_USERNAME ?? 'TODO_USERNAME';
const TEST_PASSWORD = process.env.RX_PAD_PASSWORD ?? 'TODO_PASSWORD';

test.describe('rx-pad 1.0 — Prescription Workflow (ZeroStep)', () => {
  test('should create and save a prescription using natural language actions', async ({
    page,
  }) => {
    // Step 1: Open application
    await page.goto(RX_PAD_BASE_URL);

    // Step 2: Login if required
    await ai(
      `If a login form is visible, enter username "${TEST_USERNAME}" and password "${TEST_PASSWORD}", then click the login button`,
      { page, test },
    );
    await ai('Verify that the user is logged in and the dashboard is displayed', {
      page,
      test,
    });

    // Step 3: Open prescription form
    await ai('Navigate to the Prescriptions section', { page, test });
    await ai('Click the button to create a new prescription', { page, test });
    await ai('Verify that the prescription form is displayed', { page, test });

    // Step 4: Populate mandatory fields via natural language
    await ai(
      'Enter "TODO_PATIENT_NAME" in the patient name field',
      { page, test },
    );
    await ai(
      'Enter "TODO_DOCTOR_NAME" in the doctor name field',
      { page, test },
    );
    await ai(
      'Enter "TODO_PRESCRIPTION_DATE" in the date field',
      { page, test },
    );
    await ai(
      'Enter "TODO_MEDICATION_FIELD" in the medication field',
      { page, test },
    );
    await ai(
      'Enter "TODO_DOSAGE_FIELD" in the dosage field',
      { page, test },
    );
    await ai(
      'Enter "TODO_FREQUENCY_FIELD" in the frequency field',
      { page, test },
    );
    await ai(
      'Enter "TODO_DURATION_FIELD" in the duration field',
      { page, test },
    );

    // Step 5: Save prescription
    await ai('Click the Save button to save the prescription', { page, test });

    // Step 6: Verify successful completion
    const saved = await ai(
      'Assert that a success message confirming the prescription was saved is displayed',
      { page, test },
    );
    expect(saved).toEqual(true);
  });

  test('should print a prescription using natural language', async ({
    page,
  }) => {
    await page.goto(RX_PAD_BASE_URL);

    await ai(
      `If a login form is visible, enter username "${TEST_USERNAME}" and password "${TEST_PASSWORD}", then click login`,
      { page, test },
    );
    await ai('Navigate to the Prescriptions list', { page, test });
    await ai(
      'Click on the prescription for patient "TODO_PATIENT_NAME"',
      { page, test },
    );
    await ai('Click the Print button', { page, test });

    const hasPatientName = await ai(
      'Assert that the print preview or page contains the patient name "TODO_PATIENT_NAME"',
      { page, test },
    );
    expect(hasPatientName).toEqual(true);
  });

  test('should validate mandatory fields on empty submission', async ({
    page,
  }) => {
    await page.goto(RX_PAD_BASE_URL);

    await ai(
      `If a login form is visible, log in with username "${TEST_USERNAME}" and password "${TEST_PASSWORD}"`,
      { page, test },
    );
    await ai('Navigate to Prescriptions and open a new prescription form', {
      page,
      test,
    });
    await ai(
      'Click Save without filling any fields',
      { page, test },
    );

    const hasValidationErrors = await ai(
      'Assert that validation error messages are displayed for required fields like patient name and medication',
      { page, test },
    );
    expect(hasValidationErrors).toEqual(true);
  });
});
