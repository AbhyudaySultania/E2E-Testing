# ai-testing-poc — rx-pad E2E Regression

Playwright + TypeScript regression suite for **rx-pad** (Pm-Doctor-Portal). Tests open a real browser against **UAT** or **localhost**, walk in via three entry paths, fill prescription modules, end the visit, and assert **API payloads + print view**.

**37 regression tests** in `tests/regression/` (11 module specs × 3 entry paths + all-modules × 3 + full-consultation × 1). Custom doctor-specific tests (e.g. Diet) live under `tests/custom/` and are opt-in.

| Doc | Purpose |
|-----|---------|
| [`README-dev.md`](README-dev.md) | Command cheat sheet |
| [`docs/dev-guide.md`](docs/dev-guide.md) | How to add a regression test |
| [`docs/DEMO-GUIDE.md`](docs/DEMO-GUIDE.md) | Demo walkthrough (run, generate, heal) |
| [`docs/heal-loop-v2.md`](docs/heal-loop-v2.md) | Self-healing workflow |
| [`CLAUDE.md`](CLAUDE.md) | Agent context for Cursor / Claude Code |

---

## Quick start

```bash
git clone <your-repo-url>
cd ai-testing-poc

cp .env.example .env
# Set RX_PAD_BASE_URL, RX_PAD_JWT, RX_PAD_PATIENT_NAME, RX_PAD_PATIENT_MOBILE

npm install
npx playwright install chromium
npm run test:setup

npm run test:commit-check              # pre-PR gate (~3–5 min)
CI=1 npm run test:regression            # full suite (~13–17 min)
```

**JWT:** log in to the portal → DevTools → Application → Local Storage → `authToken` → paste as `RX_PAD_JWT`. Re-run `npm run test:setup` when the token or URL changes.

**Patient:** set `RX_PAD_PATIENT_NAME` and `RX_PAD_PATIENT_MOBILE` to a patient on that doctor account (see `.env.example`).

---

## Common commands

| Goal | Command |
|------|---------|
| Refresh auth | `npm run test:setup` |
| Pre-PR check | `npm run test:commit-check` |
| Full regression | `CI=1 npm run test:regression` |
| Single module | `npm run test:regression:vitals` (etc.) |
| Headed (one module) | `npm run test:regression:vitals:headed` |
| One entry path only | `RX_PAD_ENTRY_PATH=walk-in npm run test:regression:advice` |
| Heal one module | `CI=1 npm run test:regression:diagnosis:heal` |
| Heal full suite | `CI=1 npm run test:regression:heal` |
| Apply heal patch | `npm run test:heal:apply` |
| Custom diet (opt-in) | `npm run test:custom:diet` |
| Smoke E2E-001 | `npm run test:prescription` |

Full script list: `npm run` or [`README-dev.md`](README-dev.md).

---

## Test suite

### Regression (`tests/regression/`)

Each module spec runs **walk-in**, **patient-details**, and **appointment** unless `RX_PAD_ENTRY_PATH` is set.

| Module | npm script |
|--------|------------|
| Multi-medicine | `test:regression:medications` |
| Investigation | `test:regression:investigation` |
| Medical history | `test:regression:medical-history` |
| Vaccination | `test:regression:vaccination` |
| Lab results | `test:regression:lab-results` |
| Diagnosis | `test:regression:diagnosis` |
| Vitals | `test:regression:vitals` |
| Advice | `test:regression:advice` |
| Follow-up | `test:regression:follow-up` |
| Symptoms | `test:regression:symptoms` |
| Examination | `test:regression:examination` |
| All modules (one visit) | `test:regression:all-modules` |
| Full consultation | `test:regression:full-consultation` |

### Custom (`tests/custom/`)

| Test | npm script | Notes |
|------|------------|-------|
| Diet custom module | `test:custom:diet` | Requires custom Diet module on doctor account; not in `test:regression` |

### Smoke

| ID | Spec |
|----|------|
| E2E-001 | `tests/create-prescription.spec.ts` |

---

## Architecture (short)

```
playwright.config.ts
  setup → auth.setup.ts → .auth/user.json (gitignored)
  chromium → specs with saved session

Spec → setupRegressionSession(entryPath)
     → prescription-modules.page.ts
     → endVisit + API assert (case-manager.ts)
```

- **Page Object Model** — `tests/pages/`
- **Dual locators** — `rx-*` testids + role/text fallback
- **Popup immunity** — `tests/helpers/ui-blocker-guard.ts`
- **Skills** — `.cursor/skills/` (`/generate-regression`, `/heal-regression`)

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `RX_PAD_BASE_URL` | Yes | UAT or `http://localhost:3000` |
| `RX_PAD_JWT` | Yes | Doctor JWT for `test:setup` |
| `RX_PAD_PATIENT_NAME` | Recommended | Test patient full name |
| `RX_PAD_PATIENT_MOBILE` | Recommended | Test patient mobile |
| `RX_PAD_ENTRY_PATH` | No | `walk-in` \| `patient-details` \| `appointment` |
| `RX_PAD_COMMIT_MODULE` | No | Extra spec in commit-check (slug, e.g. `vitals`) |
| `RX_PAD_CUSTOM_DIET` | No | `1` to include diet in full-consultation |
| `CI` | No | `1` — non-interactive reporters (no blocking HTML server) |

See [`.env.example`](.env.example) for all options.

---

## Localhost

```bash
# Terminal 1 — portal
cd ../Pm-Doctor-Portal && npm start

# Terminal 2 — tests
RX_PAD_BASE_URL=http://localhost:3000 npm run test:setup
RX_PAD_BASE_URL=http://localhost:3000 CI=1 npm run test:regression
```

---

## Self-healing

When a UI change breaks locators:

```bash
CI=1 npm run test:regression:diagnosis:heal   # or test:regression:heal for full suite
# Cursor: /heal-regression → proposed.patch
npm run test:heal:apply
CI=1 npm run test:heal:ground-truth           # after fix, refresh baseline
```

Details: [`docs/heal-loop-v2.md`](docs/heal-loop-v2.md).

---

## Repository layout

```
tests/
  regression/          # 37-test gate
  custom/              # opt-in doctor-specific specs
  pages/               # page objects
  helpers/             # harness, navigation, guards
  fixtures/            # test data, entry paths, testids
scripts/
  run-commit-check.mjs
  run-regression-heal.mjs
  heal/                # heal loop V2
.cursor/skills/        # generate-regression, heal-regression
docs/
  dev-guide.md
  DEMO-GUIDE.md
  heal-loop-v2.md
```

---

## Security

**Never commit:**

- `.env` (JWT, API keys)
- `.auth/` (saved browser session)

Both are in [`.gitignore`](.gitignore). Use GitHub **Secrets** for CI (`RX_PAD_JWT`, `RX_PAD_BASE_URL`, patient vars).

---

## License

ISC
