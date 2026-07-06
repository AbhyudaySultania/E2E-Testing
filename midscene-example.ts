/**
 * Midscene.js — Vision-Driven AI Automation
 *
 * Framework: Midscene.js with Playwright integration
 * Target Application: rx-pad 1.0
 *
 * Setup:
 *   npm install @midscene/web playwright @playwright/test tsx --save-dev
 *
 *   export MIDSCENE_MODEL_BASE_URL="https://your-model-service/v1"
 *   export MIDSCENE_MODEL_API_KEY="your-api-key"
 *   export MIDSCENE_MODEL_NAME="your-model-name"
 *   export MIDSCENE_MODEL_FAMILY="your-model-family"
 *
 * Run:
 *   npx tsx midscene-example.ts
 *
 * Midscene uses vision-based AI to locate and interact with UI elements.
 * Caching accelerates subsequent runs; cache invalidation triggers AI re-analysis.
 */

import { chromium } from 'playwright';
import { PlaywrightAgent } from '@midscene/web/playwright';

const RX_PAD_BASE_URL = process.env.RX_PAD_BASE_URL ?? 'TODO_BASE_URL';
const TEST_USERNAME = process.env.RX_PAD_USERNAME ?? 'TODO_USERNAME';
const TEST_PASSWORD = process.env.RX_PAD_PASSWORD ?? 'TODO_PASSWORD';

async function runPrescriptionWorkflow() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 768 });

  try {
    // Step 1: Open application
    await page.goto(RX_PAD_BASE_URL);
    await page.waitForLoadState('networkidle');

    const agent = new PlaywrightAgent(page, {
      cache: { id: 'rx-pad-prescription-poc' },
      waitForNetworkIdleTimeout: 3000,
    });

    // Step 2: Login if required
    await agent.aiAct(
      `If a login form is visible, type "${TEST_USERNAME}" in the username field and "${TEST_PASSWORD}" in the password field, then click the login button`,
    );
    await agent.aiWaitFor('the main dashboard or home page is displayed', {
      timeoutMs: 10000,
    });

    // Step 3: Open prescription form
    await agent.aiAct('navigate to the Prescriptions section');
    await agent.aiAct('click the button to create a new prescription');
    await agent.aiWaitFor('the prescription form is displayed with empty fields');

    // Step 4: Populate mandatory fields
    await agent.aiInput('TODO_PATIENT_NAME', 'patient name field');
    await agent.aiInput('TODO_DOCTOR_NAME', 'doctor name field');
    await agent.aiInput('TODO_PRESCRIPTION_DATE', 'date field');
    await agent.aiInput('TODO_MEDICATION_FIELD', 'medication field');
    await agent.aiInput('TODO_DOSAGE_FIELD', 'dosage field');
    await agent.aiInput('TODO_FREQUENCY_FIELD', 'frequency field');
    await agent.aiInput('TODO_DURATION_FIELD', 'duration field');

    // Step 5: Save prescription
    await agent.aiTap('Save button');

    // Step 6: Verify successful completion
    await agent.aiAssert(
      'a success message confirming the prescription was saved is displayed',
    );

    const prescriptionDetails = await agent.aiQuery<{
      patientName: string;
      medication: string;
      status: string;
    }>(
      '{patientName: string, medication: string, status: string}, extract prescription details from the confirmation',
    );

    console.log('Prescription saved:', prescriptionDetails);

    // Step 7: Print prescription (optional verification)
    await agent.aiTap('Print button');
    await agent.aiAssert(
      'the print preview or page contains the patient name TODO_PATIENT_NAME',
    );

    console.log('Midscene report will be generated on completion.');
  } finally {
    await browser.close();
  }
}

/**
 * Playwright Test Integration variant (using Midscene fixture).
 * Save as e2e/fixture.ts and e2e/prescription-midscene.spec.ts in a full project.
 *
 * --- e2e/fixture.ts ---
 * import { test as base } from '@playwright/test';
 * import { PlaywrightAiFixture } from '@midscene/web/playwright';
 * export const test = base.extend(PlaywrightAiFixture({
 *   cache: { id: 'rx-pad-prescription' },
 * }));
 *
 * --- e2e/prescription-midscene.spec.ts ---
 * import { test } from './fixture';
 *
 * test('create prescription via Midscene', async ({ aiAct, aiAssert, aiInput, page }) => {
 *   await page.goto('TODO_BASE_URL');
 *   await aiAct(`log in with ${TEST_USERNAME} / ${TEST_PASSWORD} if login form is shown`);
 *   await aiAct('open new prescription form');
 *   await aiInput('TODO_PATIENT_NAME', 'patient name field');
 *   await aiInput('TODO_MEDICATION_FIELD', 'medication field');
 *   await aiAct('click Save');
 *   await aiAssert('prescription saved successfully');
 * });
 */

runPrescriptionWorkflow().catch((error) => {
  console.error('Prescription workflow failed:', error);
  process.exit(1);
});
