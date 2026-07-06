# rx-pad E2E Testing Kit — Demo Guide

## What this kit gives you

- **37 deterministic regression tests** in `tests/regression/` — 11 module specs × 3 entry paths, plus all-modules × 3 and full-consultation × 1 (walk-in only). Modules: medications, vitals, investigation, diagnosis, vaccination, lab results, medical history, advice, follow-up, symptoms, examination
- **Opt-in custom tests** — doctor-specific Diet module (`tests/custom/`, not in the default regression gate)
- **AI-powered test generation** — describe a new module and Claude scaffolds the complete spec, page object methods, fixture data, and npm script in one shot via `/generate-regression`
- **AI-powered self-healing** — `npm run test:regression:heal` (full suite) or `npm run test:regression:<module>:heal` (single module); `/heal-regression` proposes a patch you review and apply with `npm run test:heal:apply`
- **Pre-PR commit check** — a 3–5 min tiered gate (`npm run test:commit-check`) that catches regressions before your code reaches UAT

---

## Quick setup (5 min)

```bash
# 1. Unzip or clone into your machine
cd ai-testing-poc

# 2. Copy env file and fill in values
cp .env.example .env
```

Open `.env` and set:

```env
RX_PAD_BASE_URL=https://pm-uat-doctor-portal.tatvacare.in
RX_PAD_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Patient for walk-in / all patients / appointment (must exist on this doctor account)
RX_PAD_PATIENT_NAME=Your Patient Name
RX_PAD_PATIENT_MOBILE=9821885020
```

**Where to get the JWT:**
1. Log in to the portal in Chrome
2. Open DevTools → Application → Local Storage
3. Find the key `authToken` — copy that value
4. Paste it as `RX_PAD_JWT=` in `.env`
5. Token expires with your session; repeat this when tests start failing with auth errors

Set `RX_PAD_PATIENT_NAME` and `RX_PAD_PATIENT_MOBILE` to a patient that exists under this doctor. If two patients share the same mobile, name + mobile are used together on the appointment path.

```bash
# 3. Install dependencies
npm install

# 4. Install Chromium browser (one-time, ~150 MB)
npx playwright install chromium

# 5. Write auth session to disk
npm run test:setup
```

You should see: `✓ authenticate via authToken` and a new file `.auth/user.json`.

---

## Demo 1: Running existing regression tests

### Run the full suite

```bash
CI=1 npm run test:regression
```

Output looks like:
```
Running 37 tests using 1 worker

  ✓ regression/advice.spec.ts:17 › Walk-in → add advice → end visit (28s)
  ✓ regression/advice.spec.ts:17 › All Patients → ... (31s)
  ✓ regression/advice.spec.ts:17 › Add Appointment → ... (42s)
  ✓ regression/diagnosis.spec.ts:19 › Walk-in → ... (22s)
  ...

  37 passed (14m 03s)
```

Typical time: **13–17 minutes**. Use `CI=1` so the HTML report server doesn't block the terminal.

### Run a single module

```bash
# Advice module (3 tests — one per entry path)
npm run test:regression:advice

# Vitals
npm run test:regression:vitals

# Investigation
npm run test:regression:investigation

# Follow-up
npm run test:regression:follow-up

# Symptoms
npm run test:regression:symptoms

# Examination
npm run test:regression:examination

# All modules in one visit (single spec, 3 entry paths)
npm run test:regression:all-modules

# Vaccination
npm run test:regression:vaccination

# Lab results
npm run test:regression:lab-results

# Diagnosis
npm run test:regression:diagnosis

# Medical history
npm run test:regression:medical-history

# Multi-medicine (2 drugs, edit + repeat Rx)
npm run test:regression:medications

# Full consultation (vitals + advice + HB 1 + edit + repeat; diet only if RX_PAD_CUSTOM_DIET=1)
npm run test:regression:full-consultation

# Custom Diet module (doctor-specific — not in test:regression gate)
npm run test:custom:diet
```

### Run a single entry path (fastest for dev iteration — ~3× faster)

Every module spec runs across 3 entry paths by default. Restrict to one:

```bash
# Walk-in only — fastest, good for local dev
RX_PAD_ENTRY_PATH=walk-in npm run test:regression:advice

# Patient-details entry path only
RX_PAD_ENTRY_PATH=patient-details npm run test:regression:vitals

# Appointment queue entry path only
RX_PAD_ENTRY_PATH=appointment npm run test:regression:investigation
```

Combine with module filter for the tightest loop:

```bash
RX_PAD_ENTRY_PATH=walk-in npm run test:regression:follow-up
# → runs 1 test in ~25 seconds instead of 3 tests in ~75 seconds
```

### Headed mode (for demos and visual debugging)

```bash
# Per-module headed shortcuts
npm run test:regression:advice:headed
npm run test:regression:all-modules:headed

# Full regression suite headed
npm run test:regression:headed

# Single entry path + headed (fastest demo loop)
RX_PAD_ENTRY_PATH=walk-in npm run test:regression:advice:headed
```

Optional slow-motion (extra pause between actions):

```bash
RX_PAD_ENTRY_PATH=walk-in PWSLOWMO=800 npm run test:regression:advice:headed
```

For a 5-minute demo clip, the prescription smoke test is the most visual:
```bash
RX_PAD_ENTRY_PATH=walk-in PWSLOWMO=600 npx playwright test tests/create-prescription.spec.ts --headed --workers=1
```

### Pre-PR commit check

```bash
npm run test:commit-check
```

Runs in **~3–5 minutes** and covers:
1. Auth smoke — confirms JWT is valid and portal loads
2. Full consultation — vitals + advice + HB 1 vaccination + edit prescription + repeat Rx (diet only when `RX_PAD_CUSTOM_DIET=1`)

If your PR touches a specific module, add it:

```bash
# PR touches vaccination logic
RX_PAD_COMMIT_MODULE=vaccination npm run test:commit-check

# PR touches medication search
RX_PAD_COMMIT_MODULE=multi-medicine npm run test:commit-check

# PR touches investigation
RX_PAD_COMMIT_MODULE=investigation npm run test:commit-check
```

The `RX_PAD_COMMIT_MODULE` value is the filename slug — e.g. `multi-medicine` for `tests/regression/multi-medicine.spec.ts`.

---

## Demo 2: Generating a new test for a module

Use this when a developer just shipped a new prescription module and needs E2E coverage for it.

### Step-by-step workflow

**Step 1: Open Claude Code in this directory**
```bash
cd ai-testing-poc
claude
```

**Step 2: Run the generate skill**

Type in the Claude Code prompt:
```
/generate-regression
```

Claude will load all context automatically (dev-guide, existing specs, page objects, fixtures) and ask you what module to generate for.

**Step 3: Answer Claude's questions**

Claude asks:
- Which module? (select from options or describe your own)
- What is the module title as shown on the prescription pad?
- What is the user flow? (e.g. "click add, search symptom, select from dropdown, assert on pad")
- What API strings appear in the `addCaseManager` payload?

You can look these up in the portal source or in the browser Network tab during a manual test.

**Step 4: Claude creates these files automatically**

| File | What gets added |
|------|----------------|
| `tests/fixtures/regression-test-data.ts` | Search terms, expected catalog strings, module title |
| `tests/pages/prescription-modules.page.ts` | `addYourModule()` and `assertYourModuleOnPad()` methods |
| `tests/utils/case-manager.ts` | Payload matcher if the module has a new API field |
| `tests/regression/your-module.spec.ts` | Full spec: 3 entry paths, API assertion, edit + repeat Rx |
| `tests/fixtures/test-ids.ts` | `MODULE_YOUR_MODULE` testid constant and title→id map entry |
| `package.json` | `"test:regression:your-module"` script |

**Step 5: Validate**

```bash
# Run just the walk-in path first (fastest)
RX_PAD_ENTRY_PATH=walk-in npm run test:regression:your-module

# If that passes, run all 3 paths
npm run test:regression:your-module

# Then add it to the full suite gate
CI=1 npm run test:regression

# Refresh ground truth so the heal loop knows the new green baseline
npm run test:heal:ground-truth
```

### Real example: generating the "Follow-up" module

Here is exactly what happened when `/generate-regression` was run to add Follow-up scheduling:

**Input given to Claude:**
- Module: Follow-up / Next Visit
- Flow: click "2 Weeks" chip → formatted date appears on pad → End Visit
- API field: `follow_up_date` in `addCaseManager` payload (YYYY-MM-DD string)

**Files created:**

`tests/fixtures/regression-test-data.ts` — added:
```typescript
followUp: {
  chipLabel: '2 Weeks',
},
// in modules:
followUp: 'Follow-up',
```

`tests/pages/prescription-modules.page.ts` — added:
```typescript
private followUpBox() {
  return moduleBoxByTitle(this.page, REGRESSION_TEST_DATA.modules.followUp, /follow.up/i);
}

async addFollowUpByChip(chipLabel: string): Promise<void> {
  await purgeUiBlockers(this.page);
  await this.appShell.dismissBlockingOverlays();
  const box = this.followUpBox();
  await box.scrollIntoViewIfNeeded();
  const chip = box
    .getByRole('button', { name: new RegExp(`^${chipLabel}$`, 'i') })
    .first();
  await expect(chip).toBeVisible({ timeout: 10_000 });
  await chip.click();
  await expect(
    box.locator('.title.fontroboto').filter({ hasText: /\d{4}/ }).first(),
  ).toBeVisible({ timeout: 10_000 });
}
```

`tests/regression/follow-up.spec.ts`:
```typescript
test.describe('RX-PAD-E2E-012: Follow-up scheduling', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → set follow-up → end visit`, async ({ page }) => {
      test.setTimeout(120_000);
      const { followUp, advice } = REGRESSION_TEST_DATA;
      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.followUp, { scrollToBottom: true });

      await modules.addFollowUpByChip(followUp.chipLabel);
      await modules.assertFollowUpOnPad();

      const saveContext = await finishModuleVisitWithPdf(page, modules, []);
      expect(saveContext.requestPayload['follow_up_date']).toBeTruthy();

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        pdfTextsAfterEdit: [advice.editAdd],
        repeatExpectations: { advice: [advice.editAdd] },
      });
    });
  }
});
```

`package.json`:
```json
"test:regression:follow-up": "playwright test tests/regression/follow-up.spec.ts"
```

**Validation run:**
```bash
RX_PAD_ENTRY_PATH=walk-in npm run test:regression:follow-up
# → 1 passed (38s)

npm run test:regression:follow-up
# → 3 passed (1m 52s)
```

**Time from `/generate-regression` to passing tests: ~8 minutes.**

---

## Demo 3: Healing tests after a UI change

Use this when a frontend developer renames a button, changes a CSS class, or restructures a component and existing tests start failing.

### Step-by-step workflow

**Step 1: Run the suite in heal mode to capture failures**

Full suite (~13–17 min):

```bash
CI=1 npm run test:regression:heal
```

Single module only (faster when you know what broke):

```bash
CI=1 npm run test:regression:diagnosis:heal
CI=1 npm run test:regression:vitals:heal
CI=1 npm run test:custom:diet:heal
```

This runs the full regression suite and:
- Collects all hard failures (not flaky/network issues)
- Prompts you to pick which failure to work on
- Writes a structured session file that Claude reads

Output:
```
V2 — Step 1: full regression (headless)
...
Regression failed — collecting hard failures (flaky excluded).
3 hard failure(s) in run.

  1) regression/advice.spec.ts — Walk-in → add advice → end visit
  2) regression/vitals.spec.ts — Walk-in → add vitals → end visit
  3) regression/investigation.spec.ts — Walk-in → add investigation → end visit

Pick failure to heal [1-3]:
```

Type `1` and press Enter. The script writes:
- `docs/heal-sessions/current-session.md` — full brief for Claude
- `test-results/heal/latest/heal-session.json` — structured session data
- `test-results/heal/latest/failure.json` — error details, stack trace, screenshots

**Step 2: Run the heal skill in Claude Code**

```bash
claude
```

Then type:
```
/heal-regression
```

Claude automatically reads `current-session.md` and `heal-session.json`, classifies the failure (UI change vs portal bug vs auth issue), and proposes specific locator fixes.

**Step 3: Claude proposes a patch**

Claude writes `test-results/heal/latest/proposed.patch` — a unified diff of only the test files that need changing. It also runs the failed spec against UAT to verify the fix.

**Step 4: You review and apply**

```bash
# Review what's in the patch
cat test-results/heal/latest/proposed.patch

# Apply, re-run the failed spec, and update ground truth if passing
npm run test:heal:apply
```

The apply script:
1. Applies the patch with `git apply`
2. Re-runs only the spec that was healed
3. If it passes — updates `test-results/last-green.json` (ground truth)
4. If it fails — rolls back the patch automatically

**Step 5: Verify the full suite is still green**

```bash
CI=1 npm run test:regression
npm run test:heal:ground-truth
```

### Real example: "End Visit button renamed to Complete Visit"

**What breaks:** The portal dev changes the "End Visit" button label in `HeaderPrescription.js`. The `rx-end-visit` testid is not on that button yet, so every spec fails when it tries to click End Visit.

**Failure output** (from `heal-session.json`):
```
Error: Locator.click: waiting for locator('button', { name: /end visit/i })
  TimeoutError: Timed out 45000ms waiting for selector
  at PrescriptionPage.clickEndVisit (tests/pages/prescription.page.ts:125)
```

**What `current-session.md` captures:**
```markdown
## Failed spec
tests/regression/advice.spec.ts

## Error
TimeoutError: Timed out waiting for button "end visit"

## Classification
ui-change (confidence: 92)

## Last known green selector
getByRole('button', { name: /end visit/i })
```

**What Claude proposes** (`proposed.patch`):
```diff
--- a/tests/pages/prescription.page.ts
+++ b/tests/pages/prescription.page.ts
@@ -119,7 +119,7 @@ export class PrescriptionPage {
   private get endVisitButton() {
     return this.page
       .getByTestId(RX_TEST_IDS.END_VISIT)
-      .or(this.page.getByRole('button', { name: /end visit/i }))
+      .or(this.page.getByRole('button', { name: /end visit|complete visit/i }))
       .first();
   }
```

**You apply:**
```bash
npm run test:heal:apply
# ✓ Patch applied
# ✓ advice.spec.ts — 3 passed
# ✓ Ground truth updated
```

**Total time from failure to green: ~5 minutes.**

---

## Demo 4: Localhost testing (test your own dev changes before UAT deploy)

When you're building a new feature on `localhost:3000`, point the tests at your local build:

**Terminal 1 — start the portal:**
```bash
cd ../Pm-Doctor-Portal
npm start
# Portal running at http://localhost:3000
```

**Terminal 2 — point tests at localhost:**
```bash
cd ai-testing-poc

# Update auth session for localhost (same JWT, different URL)
RX_PAD_BASE_URL=http://localhost:3000 npm run test:setup

# Run pre-PR check against your local build
RX_PAD_ENTRY_PATH=walk-in RX_PAD_BASE_URL=http://localhost:3000 npm run test:commit-check

# Or test a specific module you just built
RX_PAD_ENTRY_PATH=walk-in RX_PAD_BASE_URL=http://localhost:3000 npm run test:regression:advice
```

**Why this matters:** Tests use dual locators — `data-testid` first, role/text fallback. So when you add `data-testid="rx-module-advice"` to your local portal component, the test uses it immediately without any test changes.

**Localhost full gate (before pushing to UAT):**
```bash
RX_PAD_BASE_URL=http://localhost:3000 CI=1 npm run test:regression
```

**Remember:** Switch auth back to UAT after localhost testing:
```bash
npm run test:setup   # reads RX_PAD_BASE_URL from .env (UAT by default)
```

---

## Troubleshooting

**"Auth failed" / test redirects to `/login`**
```bash
# JWT expired — refresh it from DevTools → Local Storage → authToken
# Then:
npm run test:setup
```

**"Module not visible for this account" — test skipped**

This is expected behaviour. Some prescription modules are not enabled for every doctor account in UAT. The test correctly skips with a reason. Run `cat test-results/skip-report.json` to see all skips.

**Test times out after 45 seconds**

UAT can be slow. Try:
```bash
RX_PAD_ENTRY_PATH=walk-in npm run test:regression:<module>
```
Walk-in is typically 30–40% faster than the appointment path.

**"Patch failed to apply"**
```bash
npm run test:heal:rollback   # undo the patch
```
Then check `git status` — there may be a merge conflict in the test file.

**"37 tests found but 0 pass" on first run**
```bash
# Re-run setup — auth storage file may be missing or stale
npm run test:setup
```

**Playwright version mismatch after `npm install`**
```bash
npx playwright install chromium
```

---

## Key environment variables reference

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `RX_PAD_BASE_URL` | Yes | — | Target URL: UAT or `http://localhost:3000` |
| `RX_PAD_JWT` | Yes | — | Doctor auth token from localStorage `authToken` |
| `RX_PAD_PATIENT_NAME` | No | hardcoded fallback | Patient full name for navigation |
| `RX_PAD_PATIENT_MOBILE` | No | hardcoded fallback | Patient mobile for search |
| `RX_PAD_PATIENT_SEARCH` | No | mobile | Optional search query override |
| `RX_PAD_ENTRY_PATH` | No | all 3 paths | Restrict to `walk-in`, `patient-details`, or `appointment` |
| `RX_PAD_COMMIT_MODULE` | No | — | Extra spec slug for commit check (e.g. `vaccination`) |
| `RX_PAD_MEDICINE_SEARCH` | No | `Para` | First medicine search term |
| `RX_PAD_MEDICINE_SEARCH_2` | No | `Azithral` | Second medicine search term |
| `RX_PAD_SYMPTOM_SEARCH` | No | `Fever` | Symptom search term (symptoms spec uses frequent list when possible) |
| `RX_PAD_CUSTOM_DIET` | No | off | Set `1` to include custom Diet in full-consultation |
| `RX_PAD_DIET_MODULE_NAME` | No | `Diet` | Custom diet module title on pad |
| `RX_PAD_ASSERT_VACCINATION_PDF` | No | `0` | Set `1` to assert PDF text on UAT after portal deploy |
| `PWSLOWMO` | No | `0` | Milliseconds between actions (e.g. `800` for demos) |
| `CI` | No | — | Set `1` in CI to disable interactive HTML report server |
| `RX_HEAL_RUN` | No | — | Set by `test:regression:*:heal` — enables failure capture reporters |
| `RX_HEAL_SPEC` | No | — | Override heal target spec path |
| `MIDSCENE_MODEL_API_KEY` | No | — | For AI scenario runner (`tests/ai/`) only |
| `ZEROSTEP_TOKEN` | No | — | For ZeroStep hybrid specs only |

---

## Module → npm script reference

| Module | Run | Headed | Heal |
|--------|-----|--------|------|
| Multi-medicine | `test:regression:medications` | `:headed` | `:heal` |
| Investigation | `test:regression:investigation` | `:headed` | `:heal` |
| Diagnosis | `test:regression:diagnosis` | `:headed` | `:heal` |
| Medical History | `test:regression:medical-history` | `:headed` | `:heal` |
| Vaccination | `test:regression:vaccination` | `:headed` | `:heal` |
| Lab Results | `test:regression:lab-results` | `:headed` | `:heal` |
| Vitals | `test:regression:vitals` | `:headed` | `:heal` |
| Advice | `test:regression:advice` | `:headed` | `:heal` |
| Follow-up | `test:regression:follow-up` | `:headed` | `:heal` |
| Symptoms | `test:regression:symptoms` | `:headed` | `:heal` |
| Examination | `test:regression:examination` | `:headed` | `:heal` |
| All modules (one visit) | `test:regression:all-modules` | `:headed` | `:heal` |
| Full consultation | `test:regression:full-consultation` | `:headed` | `:heal` |
| Diet (custom, opt-in) | `test:custom:diet` | `:headed` | `:heal` |
| Full regression gate | `test:regression` | `test:regression:headed` | `test:regression:heal` |

Spec files live under `tests/regression/` except Diet (`tests/custom/diet-custom-module.spec.ts`).

---

## What to expect during a live demo

1. Run `RX_PAD_ENTRY_PATH=walk-in npm run test:regression:advice:headed` — audience sees Chrome open, patient searched, advice added, End Visit clicked, print view asserted
2. Show the terminal output: `3 passed (1m 42s)` and the structured API assertion log
3. Open `playwright-report/index.html` to show the trace viewer — click any test → timeline → each step with screenshot
4. Run `/generate-regression` in Claude Code, pick a new module live, show the files being written in ~3 minutes
5. Manually break a locator in `prescription.page.ts` (change `end visit` to `end-visit-typo`), run `npm run test:regression:advice:heal`, show Claude proposing the fix
