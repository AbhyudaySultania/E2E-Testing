---
name: heal-regression
description: >-
  Heal failing Playwright regression tests (V2). After test:regression:heal, read
  docs/heal-sessions/current-session.md and heal-session.json. Propose ai-testing-poc
  patches only; write proposed.patch; user runs test:heal:apply.
---

# Heal regression (ai-testing-poc V2)

## When to use

- `npm run test:regression:heal` failed and wrote `current-session.md`
- `test-results/heal/latest/heal-session.json` exists
- User asks to heal regression / fix locators after UI change

## Load context (automatic — do not ask user to assemble)

Read in order:

1. `docs/heal-sessions/current-session.md` — **primary agent brief**
2. `test-results/heal/latest/heal-session.json`
3. `test-results/heal/latest/failure.json`
4. `test-results/heal/latest/classification.json`
5. `test-results/heal/latest/error-context.md` (if present)
6. `test-results/last-green.json`

## Hard constraints

1. **Edit only `ai-testing-poc`** under `tests/` (pages, fixtures, utils, helpers/blockers)
2. **Never** edit `Pm-Doctor-Portal`
3. **One failure at a time** — spec in `heal-session.json`
4. **Heal order:** blockers → `clickResilient` → locators → assertions
5. **Assertions:** only with **explicit user approval** + documented business rule change
6. **Never:** skip tests, weaken assertions, edit `.env`, increase failure count
7. **Write patch** to path in `heal-session.json` → `proposed.patch` (unified diff)
8. **Do not** run `test:heal:apply` — user approves in terminal

## Classification

| Label | Meaning |
|-------|---------|
| `ui-change` | Locator/DOM/label — update tests |
| `bug` | API/assertion — likely portal fix |
| `env` | JWT/auth — `npm run test:setup` |

Use `confidence` (0–100). If **< 70**, warn user strongly before assertion/locator changes.

## Steps

1. Present classification + confidence + evidence
2. Ask: **"Update tests for UI change, or portal bug?"**
3. If test heal approved → edit files → save **`proposed.patch`** in session dir
4. Re-run failed spec: `CI=1 npx playwright test <failed_spec> --reporter=list`
5. Tell user: **`npm run test:heal:apply`** (applies patch, verify, ground truth, rollback on fail)

## Verify pipeline (user runs)

```bash
npm run test:heal:apply      # apply + verify + ground truth
npm run test:heal:verify     # fast tier only
npm run test:heal:ground-truth
```

## Key paths

| Area | Path |
|------|------|
| Agent brief | `docs/heal-sessions/current-session.md` |
| Blockers | `tests/helpers/ui-blocker-guard.ts` |
| Page objects | `tests/pages/` |
| V2 docs | `docs/heal-loop-v2.md` |
