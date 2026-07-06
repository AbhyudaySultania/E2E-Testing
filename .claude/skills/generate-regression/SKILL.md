---
name: generate-regression
description: >-
  Scaffold new rx-pad Playwright regression tests in ai-testing-poc. Use when adding
  E2E coverage for a prescription module, new feature, or user asks to generate/create
  regression test cases. Outputs repo-correct spec, page object methods, test data,
  test-ids, and npm script — not raw Playwright codegen.
---

# Generate regression test (ai-testing-poc)

Scaffold **deterministic** regression tests that match the existing 29-test suite patterns.
Complements Playwright Planner/Generator (`npx playwright init-agents`) — those produce generic drafts; this skill enforces **harness + POM + API asserts**.

## When to use

- New prescription module or feature needs E2E coverage
- User asks to "add a regression test", "generate test cases", or "scaffold E2E"
- After Playwright Planner produces a markdown plan — convert it to repo format here
- **Not** for: heal loop (use `heal-regression`), Midscene/ZeroStep demos, or editing `Pm-Doctor-Portal`

## Before coding — gather inputs

Ask or infer (do not block on missing optional fields):

| Input | Required | Example |
|-------|----------|---------|
| Module title on pad | Yes | `Clinical Advices`, `Investigation` |
| User flow | Yes | Search → select → assert on pad → End Visit |
| Catalog / API strings | Yes | Exact `addCaseManager` payload values |
| E2E ID | No | Next free: E2E-012+ (check existing specs) |
| Entry paths | Default all 3 | walk-in, patient-details, appointment |
| Edit + Repeat Rx | Default yes | Standard module pattern |
| Portal testid | Recommended | `rx-module-*` in portal + mirror |

Read portal source **for context only** (`Pm-Doctor-Portal`) — suggest testids; do not edit portal unless user explicitly requests.

## Load context (read first)

1. `docs/dev-guide.md` §4–§6 — canonical steps
2. Closest existing spec — pick by UI pattern:

| Pattern | Template spec |
|---------|---------------|
| Search + autocomplete module | `tests/regression/investigation.spec.ts` |
| Drawer / form module | `tests/regression/vitals.spec.ts` |
| Simple list module | `tests/regression/advice.spec.ts` |
| Custom module (diet) | `tests/custom/diet-custom-module.spec.ts` |
| Mega multi-module | `tests/regression/full-consultation.spec.ts` |

3. `tests/fixtures/regression-test-data.ts` — patient, APIs, modules map
4. `tests/pages/prescription-modules.page.ts` — existing `add*` / `assert*` methods
5. `tests/utils/case-manager.ts` — payload matchers
6. `tests/fixtures/test-ids.ts` — `RX_MODULE_BOX_BY_TITLE` mirror

Templates: [templates.md](templates.md)

## Hard constraints

1. **Edit only `ai-testing-poc`** unless user approves portal testid PR separately
2. **Three entry paths** by default — `for (const entryPath of ENTRY_PATHS)` in spec
3. **API assertions first** — `addCaseManager` / `viewCaseManager` via `case-manager.ts`; PDF text is secondary
4. **Dual locators** — `getByTestId('rx-*')` first, role/text fallback (`test-id-locator.ts`)
5. **Reuse harness** — `setupRegressionSession`, `finishRegressionVisit` or `finishModuleVisitWithPdf`, `runEditAndRepeatRxValidation`
6. **Module guard** — `skipIfModuleNotVisible` when module may be absent for doctor account
7. **Never** weaken assertions, skip tests without `test.skip` + reason, or commit `.env` / JWT
8. **Pilot specs** — add `captureHealFailureArtifacts` in `afterEach` if spec is heal-pilot tier (see `vitals.spec.ts`)

## Generation workflow

```
Progress:
- [ ] 1. Confirm module pattern + test data strings
- [ ] 2. regression-test-data.ts
- [ ] 3. case-manager.ts matchers (if new payload shape)
- [ ] 4. prescription-modules.page.ts methods
- [ ] 5. tests/regression/<slug>.spec.ts
- [ ] 6. package.json script
- [ ] 7. test-ids.ts (+ portal testid checklist for dev)
- [ ] 8. Validate walk-in path
```

### Step 1 — Test data

`tests/fixtures/regression-test-data.ts`:

```typescript
myModule: {
  searchTerm: '…',
  expectedName: '…',   // exact API string
  displayLabel: '…',   // UI row if truncated
},
modules: {
  myModule: 'Module Title As Shown On Pad',
},
```

Slug = kebab-case filename: `my-module` → `tests/regression/my-module.spec.ts`

### Step 2 — API matchers

`tests/utils/case-manager.ts` — add extractor + `*MatchesName` helper if module has new payload field.

Prefer reusing `finishRegressionVisit(page, modules, {}, { field: value })` when `assertSaveAndPreview` already supports the field.

### Step 3 — Page object

`tests/pages/prescription-modules.page.ts`:

- `addMyModule(…)` — call `purgeUiBlockers`, `dismissBlockingOverlays`, `clickResilient` on intercepted clicks
- `assertMyModuleOnPad(…)` — pad widget assertions
- Use `moduleBoxByTitle`, `moduleEntryButton`, `scrollModuleIntoView`, `collapsePastVisitDataIfExpanded`

| UI type | Pattern |
|---------|---------|
| Sidebar box | `moduleBoxByTitle(page, title, /fallback/i)` |
| Drawer | `.ant-drawer-open` + `.modal-title` |
| Autocomplete | `waitForResponse` on search API → select option |
| React inputs | `fill()` + `dispatchEvent('input'/'change')` |

### Step 4 — Spec file

`tests/regression/<slug>.spec.ts`:

- `test.describe('RX-PAD-E2E-0XX: …')`
- Loop `ENTRY_PATHS`
- `test.setTimeout(360_000)` — or `120_000` if team prefers faster fail during heal runs
- `setupRegressionSession` → `skipIfModuleNotVisible` → add → assert → save → API expect → `runEditAndRepeatRxValidation`

Choose finish helper:

| Helper | When |
|--------|------|
| `finishRegressionVisit` | Uses `assertSaveAndPreview` field map |
| `finishModuleVisitWithPdf` | PDF text lines + `saveContext` for custom API expects |

### Step 5 — npm script

`package.json`:

```json
"test:regression:<slug>": "playwright test tests/regression/<slug>.spec.ts"
```

Optional commit-check: `RX_PAD_COMMIT_MODULE=<slug> npm run test:commit-check`

### Step 6 — Test IDs (recommended)

Portal: `Pm-Doctor-Portal/src/utils/e2eTestIds.js` + `data-testid` on module box.

Mirror: `tests/fixtures/test-ids.ts` → `RX_MODULE_BOX_BY_TITLE['Module Title']`

Tell user to add portal testids in a **separate PR** if not editing portal now.

### Step 7 — Validate

```bash
RX_PAD_ENTRY_PATH=walk-in npm run test:regression:<slug>
RX_PAD_COMMIT_MODULE=<slug> npm run test:commit-check   # optional pre-PR
CI=1 npm run test:regression                            # before merge / ground truth
npm run test:heal:ground-truth                          # refresh last-green.json
```

## Product rules (encode in tests)

| Area | Rule |
|------|------|
| Lab results | Consultation-date column in print; align date picker |
| Vaccination | `tvc_name` in API (e.g. HB 1); PDF assert localhost unless `RX_PAD_ASSERT_VACCINATION_PDF=1` |
| Vitals / vaccination modal | Consultation date, not wall-clock today |
| Long-history patients | `collapsePastVisitDataIfExpanded()` before left-rail clicks |
| Repeat Rx | Vaccination may not pre-fill; lab may not show on pad widget |
| Localhost | Dismiss `#webpack-dev-server-client-overlay` via ui-blocker-guard |

## Playwright agents (optional upstream)

Use **before** this skill for discovery:

```bash
npx playwright init-agents --loop=vscode
# @planner → markdown plan
# @generator → raw draft (refactor into steps below)
```

Do **not** commit raw generator output without converting to harness/POM pattern.

## Output checklist (report to user)

When done, summarize:

1. **Files created/modified** (list paths)
2. **E2E ID** and test count (paths × 3 unless single-path)
3. **Validation commands** run + results
4. **Portal follow-ups** (testids, print payload) if any
5. **Ground truth** — new tests included in `npm run test:regression`; run `test:heal:ground-truth` after green full suite

## Related

| Doc | Purpose |
|-----|---------|
| `docs/dev-guide.md` | Full developer guide |
| `docs/heal-loop-v2.md` | Fix tests after UI change |
| `docs/skills/heal-regression/SKILL.md` | Heal failing tests |
| `docs/regression-test-verification-summary.md` | Per-spec verify matrix |
