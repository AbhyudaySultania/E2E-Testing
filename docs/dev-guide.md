# Developer guide — adding and running rx-pad E2E tests

How to run tests, validate portal changes, and add new regression coverage in `ai-testing-poc`.

Quick start (commands only): `README-dev.md` in repo root.

---

## 1. One-time setup

```bash
cd ai-testing-poc
cp .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `RX_PAD_BASE_URL` | `https://pm-uat-doctor-portal.tatvacare.in` or `http://localhost:3000` |
| `RX_PAD_JWT` | Doctor JWT (`eyJ…`) — never commit |
| `RX_PAD_PATIENT_NAME` | Patient full name for walk-in / all patients / appointment (match JWT account) |
| `RX_PAD_PATIENT_MOBILE` | Patient mobile for search |
| `RX_PAD_PATIENT_SEARCH` | Optional search query (defaults to mobile) |
| `RX_PAD_CUSTOM_DIET` | Set `1` to include custom Diet in full-consultation; use `npm run test:custom:diet` for diet-only |
| `ZEROSTEP_TOKEN` | Optional — ZeroStep hybrid specs only |

```bash
npm install
npx playwright install chromium
npm run test:setup    # after URL or JWT change
```

---

## 2. Which command when

| When | Command | Time |
|------|---------|------|
| Before every PR | `npm run test:commit-check` | ~3–5 min |
| After portal feature work (localhost) | `RX_PAD_BASE_URL=http://localhost:3000 RX_PAD_ENTRY_PATH=walk-in RX_PAD_COMMIT_MODULE=<module> npm run test:commit-check` | ~3–5 min |
| Full regression gate | `CI=1 npm run test:regression` | ~13–17 min |
| Single module | `npm run test:regression:<module>` | ~2–8 min |
| Single entry path | `RX_PAD_ENTRY_PATH=walk-in npm run test:regression:<module>` | ~⅓ of module time |
| Record demo (headed) | See §8 below | ~5 min |

---

## 3. Portal changes without UAT deploy

1. Start portal: `cd Pm-Doctor-Portal && npm start`
2. Point tests at localhost:
   ```bash
   RX_PAD_BASE_URL=http://localhost:3000 npm run test:setup
   ```
3. Run commit-check or affected module spec.
4. For `rx-*` testids (Phase B), portal branch must be running locally.

Tests use **dual locators**: `getByTestId('rx-…')` first, role/text fallback for UAT without testids.

---

## 4. How to add a new module regression test

### Step 1 — Add test data

`tests/fixtures/regression-test-data.ts`

```typescript
myModule: {
  searchTerm: '…',
  expectedName: '…',  // API / save payload string
  displayLabel: '…',  // UI row label if truncated
},
modules: {
  myModule: 'Module Title As Shown On Pad',  // sidebar box title
},
```

### Step 2 — Add interaction methods

`tests/pages/prescription-modules.page.ts`

- `addMyModule(…)` — open drawer/box, fill, save
- `assertMyModuleOnPad(…)` — verify UI after add
- Reuse: `moduleBoxByTitle`, `moduleEntryButton`, `clickResilient`, `purgeUiBlockers`

Patterns:

| UI type | Pattern |
|---------|---------|
| Sidebar module box | `moduleBox(REGRESSION_TEST_DATA.modules.X)` |
| Drawer with title | `.ant-drawer-open` + `.modal-title` |
| Autocomplete | `waitForResponse` on search API → select option |
| React inputs | `fill()` + `dispatchEvent('input'/'change')` |
| Save | `endVisitAndWaitForSave()` reads `addCaseManager` body |

### Step 3 — Add API assertions (preferred over PDF text)

`tests/utils/case-manager.ts` — extractors + matchers (`extractXFromPayload`, `xMatchesName`).

Print preview uses canvas PDF — assert via **addCaseManager request** and **viewCaseManager** in `prescription-print-view.page.ts` → `assertSaveAndPreview()`.

### Step 4 — Create spec file

`tests/regression/my-module.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import {
  entryPathTitle,
  finishRegressionVisit,
  setupRegressionSession,
} from '../helpers/regression.harness';
import { skipIfModuleNotVisible } from '../utils/module-guards';

test.describe('RX-PAD-E2E-0XX: My module', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add → end visit`, async ({ page }) => {
      test.setTimeout(360_000);
      const { myModule } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.myModule);

      await modules.addMyModule(myModule);

      await finishRegressionVisit(page, modules, {}, {
        // pass fields assertSaveAndPreview understands
      });
    });
  }
});
```

### Step 5 — Add npm script

`package.json`:

```json
"test:regression:my-module": "playwright test tests/regression/my-module.spec.ts"
```

Optional commit-check:

```bash
RX_PAD_COMMIT_MODULE=my-module npm run test:commit-check
```

(slug = filename without `.spec.ts`)

### Step 6 — Portal testids (recommended)

`Pm-Doctor-Portal/src/utils/e2eTestIds.js` — add constant.

Portal component — `data-testid={E2E_TEST_IDS.MY_CONTROL}`.

Mirror in `tests/fixtures/test-ids.ts`.

Use `locatorByTestIdOr(page, RX_TEST_IDS.X, fallback)` in page objects.

### Step 7 — Validate

```bash
RX_PAD_ENTRY_PATH=walk-in npm run test:regression:my-module
CI=1 npm run test:regression   # before merge
```

---

## 5. Product rules to encode in tests

| Area | Rule |
|------|------|
| Lab results | Values on **consultation date** column appear in print; use consultation day in date picker, not only wall-clock today |
| Vaccination | IAP schedule name is `tvc_name` (e.g. HB 1); brand is `tvac_name` |
| Vitals / vaccination modal | Pre-filled with **consultation date**, not today |
| Long-history patients | Call `collapsePastVisitDataIfExpanded()` before left-rail clicks |
| Repeat Rx | Lab params persist via API; pad widget may not show consultation-date column |

---

## 6. Self-healing scope

See `docs/self-healing.md`.

| Heals | Does not heal |
|-------|----------------|
| MoEngage / Talkative popups | Button label rename without `data-testid` |
| `clickResilient` on intercepted clicks | New mandatory wizard step |
| Stable `rx-*` testids when label changes | API contract changes |

---

## 7. ZeroStep (optional)

- Specs: `create-prescription-zerostep.spec.ts`, `nav/walk-in-consult-zerostep.spec.ts`
- AI for **actions**; Playwright for **assertions**
- Requires `ZEROSTEP_TOKEN`
- Not used in full 29-test regression (determinism + quota)

```bash
npm run test:prescription:zerostep
```

---

## 8. Headed demo recording (~5 min)

**Recommended script** (localhost portal + visible browser):

```bash
cd ai-testing-poc
RX_PAD_BASE_URL=http://localhost:3000 npx playwright test \
  tests/create-prescription.spec.ts \
  --headed --workers=1
```

~2–3 min: walk-in → patient search → consult → medication → End Visit/Complete → print assert.

**Add AI angle** (second recording or append):

```bash
RX_PAD_BASE_URL=http://localhost:3000 npm run test:prescription:zerostep -- --headed --workers=1
```

**Broader smoke** (if time allows):

```bash
RX_PAD_BASE_URL=http://localhost:3000 npx playwright test \
  tests/regression/full-consultation.spec.ts \
  --headed --workers=1
```

~5–8 min: vitals + advice + diet + vaccination + edit + repeat Rx.

**Show `data-testid` benefit:** rename End Visit label in `HeaderPrescription.js`, re-run `test:prescription --headed` — still passes via `rx-end-visit`.

---

## 9. File map

| Path | Role |
|------|------|
| `tests/regression/*.spec.ts` | Module scenarios × 3 entry paths |
| `tests/pages/prescription-modules.page.ts` | Module interactions |
| `tests/pages/prescription.page.ts` | End Visit, medication search |
| `tests/helpers/regression.harness.ts` | `setupRegressionSession`, `finishRegressionVisit` |
| `tests/helpers/navigate-to-prescription.ts` | Walk-in / patient-details / appointment |
| `tests/fixtures/regression-test-data.ts` | Patient, catalog strings, APIs |
| `tests/fixtures/test-ids.ts` | Mirror of portal `e2eTestIds.js` |
| `tests/utils/case-manager.ts` | Save payload parse + assert helpers |
| `scripts/run-commit-check.mjs` | Pre-PR tier runner |

---

## 10. Docs index

| Doc | Content |
|-----|---------|
| `docs/POC-CONFLUENCE.md` | Full POC narrative for Confluence |
| `docs/progress.md` | Session log — challenges and fixes |
| `docs/checklist.md` | Phase status tracker |
| `docs/self-healing.md` | Phase A scope |
| `docs/zerostep-selector-mapping.md` | ZeroStep hybrid mapping |
| `research-report.md` | Framework evaluation |
