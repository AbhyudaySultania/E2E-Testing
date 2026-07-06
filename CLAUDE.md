# ai-testing-poc — Claude Code context

Playwright + TypeScript E2E regression suite for the **rx-pad** (Pm-Doctor-Portal).  
37 regression tests in `tests/regression/`. API-first assertions, Page Object Model, auth reuse via `.auth/user.json`.

## Quick orientation

| What | Where |
|------|-------|
| Spec files | `tests/regression/*.spec.ts` |
| Page objects | `tests/pages/` |
| Test data + IDs | `tests/fixtures/` |
| Heal scripts | `scripts/heal/`, `scripts/run-heal*.mjs` |
| Auth setup | `tests/auth.setup.ts` |
| Dev guide | `docs/dev-guide.md` |

## Setup

```bash
cp .env.example .env   # fill RX_PAD_BASE_URL and RX_PAD_JWT
npm install
npx playwright install chromium
npm run test:setup
```

## Key commands

```bash
npm run test:commit-check           # before every PR (~3-5 min)
CI=1 npm run test:regression        # full gate (~13-17 min)
npm run test:regression:<module>    # single module
npm run test:regression:heal        # run suite → capture failures for heal
npm run test:heal:apply             # apply proposed.patch + verify
npm run test:heal:ground-truth      # refresh last-green.json after full green run
```

## Skills

Two skills are available. Invoke them with `/heal-regression` or `/generate-regression`:

- **`/heal-regression`** — fix failing locators/selectors after a UI change. Run `npm run test:regression:heal` first; the skill reads `docs/heal-sessions/current-session.md`.
- **`/generate-regression`** — scaffold a new module spec (spec file, page object methods, test data, npm script, test IDs). Follows harness/POM patterns of existing regression specs.

Full skill docs: `.cursor/skills/heal-regression/SKILL.md` and `.cursor/skills/generate-regression/SKILL.md`.

## Hard rules

- **Edit only `ai-testing-poc`** (tests/, scripts/, docs/). Never edit `Pm-Doctor-Portal` unless user explicitly approves.
- Never weaken assertions or skip tests without `test.skip` + reason comment.
- Never commit `.env` or JWT values.
- Heal changes go to `proposed.patch`; user applies via `npm run test:heal:apply`.
