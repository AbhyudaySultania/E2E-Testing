/**
 * CodeceptJS + AI Features — BDD-Style Testing with AI Assistance
 *
 * Framework: CodeceptJS with Playwright helper and AI heal recipes
 * Target Application: rx-pad 1.0
 *
 * Setup:
 *   npm install codeceptjs playwright --save-dev
 *   npx codeceptjs init
 *
 * Configure AI in codecept.conf.js:
 *   ai: {
 *     request: async (prompt) => {
 *       // Send prompt to OpenAI/Anthropic and return response
 *       const response = await openai.chat.completions.create({
 *         model: 'gpt-4o',
 *         messages: [{ role: 'user', content: prompt }],
 *       });
 *       return response.choices[0].message.content;
 *     },
 *   },
 *
 * Run:
 *   npx codeceptjs run --steps
 *   npx codeceptjs run --debug  (enables pause() for AI assistance)
 */

Feature('rx-pad 1.0 — Prescription Workflow');

const RX_PAD_BASE_URL = process.env.RX_PAD_BASE_URL || 'TODO_BASE_URL';
const TEST_USERNAME = process.env.RX_PAD_USERNAME || 'TODO_USERNAME';
const TEST_PASSWORD = process.env.RX_PAD_PASSWORD || 'TODO_PASSWORD';

Before(({ I }) => {
  I.amOnPage(RX_PAD_BASE_URL);
});

Scenario('Create and save a prescription with all mandatory fields', ({ I }) => {
  // Step 1: Login if required
  I.say('Checking if login is required');
  I.waitForElement({ css: '[data-testid="login-form"], .dashboard, #app' }, 10);

  within('[data-testid="login-form"]', () => {
    I.fillField('Username', TEST_USERNAME);
    I.fillField('Password', TEST_PASSWORD);
    I.click('Login');
  }).catch(() => {
    I.say('Login form not found — user may already be authenticated');
  });

  // Step 2: Open prescription form
  I.click('Prescriptions');
  I.click('New Prescription');
  I.waitForText('Prescription', 10);

  // Step 3: Populate mandatory fields
  // TODO: Replace with actual selectors once rx-pad field mapping is confirmed
  I.fillField({ name: 'patientName' }, 'TODO_PATIENT_NAME');
  I.fillField({ name: 'doctorName' }, 'TODO_DOCTOR_NAME');
  I.fillField({ name: 'prescriptionDate' }, 'TODO_PRESCRIPTION_DATE');
  I.fillField({ name: 'medication' }, 'TODO_MEDICATION_FIELD');
  I.fillField({ name: 'dosage' }, 'TODO_DOSAGE_FIELD');
  I.fillField({ name: 'frequency' }, 'TODO_FREQUENCY_FIELD');
  I.fillField({ name: 'duration' }, 'TODO_DURATION_FIELD');

  // Step 4: Save prescription
  I.click('Save');

  // Step 5: Verify successful completion
  I.waitForText('prescription saved successfully', 10);
  I.see('prescription saved successfully');
});

Scenario('Print a saved prescription', ({ I }) => {
  within('[data-testid="login-form"]', () => {
    I.fillField('Username', TEST_USERNAME);
    I.fillField('Password', TEST_PASSWORD);
    I.click('Login');
  }).catch(() => {});

  I.click('Prescriptions');
  I.click('TODO_PATIENT_NAME');
  I.click('Print');

  I.switchToNextTab();
  I.waitForText('TODO_PATIENT_NAME', 10);
  I.see('TODO_PATIENT_NAME');
});

Scenario('Show validation errors for empty mandatory fields', ({ I }) => {
  within('[data-testid="login-form"]', () => {
    I.fillField('Username', TEST_USERNAME);
    I.fillField('Password', TEST_PASSWORD);
    I.click('Login');
  }).catch(() => {});

  I.click('Prescriptions');
  I.click('New Prescription');
  I.click('Save');

  I.waitForText('patient name is required', 5);
  I.see('patient name is required');
  I.see('medication is required');
});

/**
 * AI-Assisted Test Writing (development mode only)
 *
 * Run with: npx codeceptjs run --debug
 * Then in pause() mode:
 *
 *   I.askGptOnPage('What fields are on this prescription form?');
 *   I.askForPageObject('PrescriptionForm');
 *   I.askGptOnPageFragment(
 *     'Generate CodeceptJS steps to fill all mandatory fields',
 *     '[data-testid="prescription-form"]'
 *   );
 */

/**
 * Self-Healing via Heal Recipes (codecept.conf.js)
 *
 * exports.config = {
 *   plugins: {
 *     heal: {
 *       enabled: true,
 *       recipes: [
 *         async ({ I, error, step }) => {
 *           const suggestion = await ai.request(
 *             `Test failed at step "${step}". Error: ${error.message}.
 *              Page HTML: ${await I.grabSource()}.
 *              Suggest a CodeceptJS fix.`
 *           );
 *           // Execute AI-suggested fix
 *           eval(suggestion);
 *         },
 *       ],
 *     },
 *   },
 * };
 */

/**
 * Example codecept.conf.js for Playwright helper
 *
 * exports.config = {
 *   tests: './codecept-example.js',
 *   output: './output',
 *   helpers: {
 *     Playwright: {
 *       url: process.env.RX_PAD_BASE_URL || 'TODO_BASE_URL',
 *       show: false,
 *       browser: 'chromium',
 *     },
 *   },
 *   include: {
 *     I: './steps_file.js',
 *   },
 *   ai: {
 *     request: async (prompt) => { ... },
 *   },
 *   plugins: {
 *     heal: { enabled: true },
 *     analyze: { enabled: true },
 *   },
 * };
 */
