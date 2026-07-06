# Developer guide — rx-pad E2E (ai-testing-poc)

Quick reference for running Playwright tests against UAT or a local portal build.

**POC status:** Complete — **37 regression tests** in `tests/regression/` (11 module specs × 3 entry paths + all-modules × 3 + full-consultation × 1).

For step-by-step **how to add a new test**, see [`docs/dev-guide.md`](docs/dev-guide.md).

---

## One-time setup

```bash
cd ai-testing-poc
cp .env.example .env
npm install
npx playwright install chromium
```

Edit `.env`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `RX_PAD_BASE_URL` | Yes | UAT URL or `http://localhost:3000` |
| `RX_PAD_JWT` | Yes | Doctor JWT (`eyJ…`) from QA or one manual login |
| `RX_PAD_ENTRY_PATH` | No | `walk-in` \| `patient-details` \| `appointment` — run one path only (~3× faster) |
| `RX_PAD_COMMIT_MODULE` | No | Extra module in commit-check (filename slug, see below) |
| `RX_PAD_ASSERT_VACCINATION_PDF` | No | `1` to assert PDF `HB 1` on UAT (after portal deploy) |
| `ZEROSTEP_TOKEN` | No | ZeroStep hybrid specs only — https://zerostep.com |

Refresh auth storage after changing URL or token:

```bash
npm run test:setup
```

---

## Which script when

| Goal | Command | Typical time |
|------|---------|--------------|
| **Before every PR** | `npm run test:commit-check` | ~3–5 min |
| Full regression gate | `CI=1 npm run test:regression` | ~13–17 min |
| Smoke (walk-in → 1 med → End Visit) | `npm run test:prescription` | ~2–3 min |
| Auth smoke only | `npm run test:smoke` | ~30 s |
| Single module (all 3 entry paths) | `npm run test:regression:vaccination` (etc.) | ~2–8 min |
| Regression with visible browser | `npm run test:regression:headed` | same as full suite |
| Playwright UI mode | `npm run test:ui` | interactive |

Use `CI=1` in CI or when you want non-interactive reporters (avoids blocking HTML server).

### Commit check tier

`test:commit-check` runs:

1. Authenticated shell smoke (`authenticated-access.spec.ts`)
2. Full walk-in consultation (`full-consultation.spec.ts`) — vitals, advice, diet, vaccination, edit + repeat Rx

Optional extra module when your PR touches a specific area:

```bash
RX_PAD_COMMIT_MODULE=vaccination npm run test:commit-check
RX_PAD_COMMIT_MODULE=multi-medicine npm run test:commit-check
```

**Module slug** = regression filename without `.spec.ts` (e.g. `multi-medicine`, not `medications`).

| Slug | Spec |
|------|------|
| `multi-medicine` | `tests/regression/multi-medicine.spec.ts` |
| `investigation` | `tests/regression/investigation.spec.ts` |
| `medical-history` | `tests/regression/medical-history.spec.ts` |
| `vaccination` | `tests/regression/vaccination.spec.ts` |
| `lab-results` | `tests/regression/lab-results.spec.ts` |
| `diagnosis` | `tests/regression/diagnosis.spec.ts` |
| `vitals` | `tests/regression/vitals.spec.ts` |
| `advice` | `tests/regression/advice.spec.ts` |
| `diet` (custom, opt-in) | `tests/custom/diet-custom-module.spec.ts` — `npm run test:custom:diet` |

### Faster local iteration

Run only the walk-in entry path (skips patient-details + appointment variants):

```bash
RX_PAD_ENTRY_PATH=walk-in npm run test:regression:vaccination
```

Combine with localhost portal when Phase B `rx-*` testids are running locally:

```bash
# Terminal 1 — portal
cd ../Pm-Doctor-Portal && npm start

# Terminal 2 — tests
RX_PAD_BASE_URL=http://localhost:3000 npm run test:setup
RX_PAD_ENTRY_PATH=walk-in npm run test:commit-check
```

---

## Local portal + tests

1. Start portal on port 3000 (`npm start` or `npm run start:dev` in `Pm-Doctor-Portal`).
2. Set `RX_PAD_BASE_URL=http://localhost:3000` in `.env`.
3. Run `npm run test:setup` (JWT must still be valid for that environment).
4. Run `npm run test:commit-check` or targeted regression scripts.

UAT does **not** require a local portal — default `.env` targets UAT. Tests use **dual locators** (`data-testid` first, role/text fallback) so they pass on UAT without portal testids and on localhost with `rx-*` testids.

**Vaccination PDF:** API `vaccines.given` is asserted on every target. PDF line `HB 1` is asserted on **localhost** only until the portal print-payload fix is deployed to UAT. Force on UAT with `RX_PAD_ASSERT_VACCINATION_PDF=1` after deploy.

**Localhost full gate:**

```bash
RX_PAD_BASE_URL=http://localhost:3000 CI=1 npm run test:regression
```

---

## Self-healing regression loop (V2)

See **`docs/heal-loop-v2.md`**.

```bash
CI=1 npm run test:regression:heal              # full suite → pick failure
CI=1 npm run test:regression:diagnosis:heal    # single module (faster)
# Cursor Agent (heal-regression) → proposed.patch
npm run test:heal:apply                        # apply + verify + ground truth
npm run test:heal:verify                       # fast tier only
```

Per-module heal: `npm run test:regression:<module>:heal` (same list as `test:regression:<module>`). Custom diet: `npm run test:custom:diet:heal`. Override via `RX_HEAL_SPEC=path/to.spec.ts`.

---

## AI natural-language scenarios (`tests/ai/`)

Markdown steps are executed at runtime by **Midscene** (vision + NL). Only `## Verify` uses Playwright (`expect` URL, etc.). No per-step Playwright anchors — if Midscene fails, fall back to Option C (hybrid anchors).

```bash
# All scenarios in tests/ai/scenarios/*.md
npm run test:ai:headed

# One scenario
RX_AI_SCENARIO=walk-in-prescription npm run test:ai:headed
```

Add a scenario: create `tests/ai/scenarios/my-flow.md` with `## Steps` (numbered or bullets) and optional `## Verify` (`url includes: /path`).

**Requires** Midscene model env vars in `.env` — see `.env.example` (`MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_NAME`, `MIDSCENE_MODEL_FAMILY`, `MIDSCENE_MODEL_BASE_URL`). Not deterministic — separate from `test:regression`.

Legacy ZeroStep markdown runner (Playwright anchors): `npm run test:ai:zerostep:headed`

## ZeroStep (optional hybrid demo)

Requires `ZEROSTEP_TOKEN` in `.env`. AI for **actions**; Playwright for **assertions**. Not used in the 29-test regression suite.

```bash
npm run test:prescription:zerostep
npm run test:nav:zerostep
```

---

## JWT notes

- Token expires — refresh from browser DevTools → Application → localStorage (`authToken` key used by setup).
- Never commit `.env` or paste tokens into PRs.
- After token refresh, re-run `npm run test:setup`.

---

## Reports & debugging

```bash
cat test-results/skip-report.json   # module-not-visible skips
cat test-results/blocker-log.json   # Phase A UI blocker dismiss events
npm run trace                       # open last failure trace
```

---

## Adding new tests

See **`docs/dev-guide.md`** — test data, page objects, spec template, portal testids, validation commands.

---

## Docs

| Doc | Purpose |
|-----|---------|
| `docs/dev-guide.md` | **How to add a regression test** (step-by-step) |
| `docs/POC-CONFLUENCE.md` | Full POC narrative for Confluence |
| `docs/CONFLUENCE-FULL-UPDATE-JUN-2026.md` | **Jun 2026 update — heal loop + findings** |
| `docs/checklist.md` | Phase status, POC sign-off |
| `docs/progress.md` | Session log of fixes and methods |
| `docs/self-healing.md` | Phase A/B scope (popup guard + testids) |
| `docs/zerostep-selector-mapping.md` | ZeroStep hybrid mapping |
| `research-report.md` | Framework evaluation (Playwright, ZeroStep, etc.) |

---

## 5-minute demo video (headed)

Start portal locally, then:

```bash
RX_PAD_BASE_URL=http://localhost:3000 npx playwright test tests/create-prescription.spec.ts --headed --workers=1
```

Optional AI clip:

```bash
RX_PAD_BASE_URL=http://localhost:3000 npm run test:prescription:zerostep -- --headed --workers=1
```

Do **not** record full `npm run test:regression` for a 5 min video (~16+ min). Use `test:prescription` or `RX_PAD_ENTRY_PATH=walk-in` with a single module instead.
