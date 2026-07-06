# Self-healing (Phase A) — UI blocker immunity

Phase A hardens tests against **popups, banners, and click interception** without changing the portal app.

## Architecture

| File | Role |
|------|------|
| `tests/fixtures/ui-blockers.ts` | Registry of known blocker IDs (documentation + DOM selectors) |
| `tests/helpers/ui-blocker-guard.ts` | `dismissKnownBlockers`, `clickResilient`, `installUiBlockerGuard` |
| `tests/helpers/premium-popup-guard.ts` | MoEngage init script + route abort (unchanged) |
| `tests/reporters/blocker-log.reporter.ts` | Writes `test-results/blocker-log.json` after each run |

## Usage in page objects

```ts
import { clickResilient, dismissKnownBlockers } from '../helpers/ui-blocker-guard';

// Before any critical click
await dismissKnownBlockers(page, 'queue-consult');

// Click with auto-retry via evaluate() when Talkative/etc. intercepts
await clickResilient(page, menuConsult, { label: 'consult-menuitem' });
```

`AppShellPage.dismissBlockingOverlays()` delegates to `dismissKnownBlockers()`.

## Adding a new blocker

1. Add an entry to `UI_BLOCKER_REGISTRY` in `tests/fixtures/ui-blockers.ts`.
2. Add dismiss logic in `dismissKnownBlockers()` in `ui-blocker-guard.ts`.
3. Call `recordBlockerDismissal(id, action, context)` when dismissed.
4. Re-run regression — check `test-results/blocker-log.json` for the new id.

**Do not** add broad handlers on `.ant-modal-wrap` or generic `/close/i` button matchers — they close legitimate product dialogs (vaccination, appointment drawer).

Use `purgeInterceptorsOnly()` inside open menus/dropdowns; use `dismissKnownBlockers()` before navigation only.

## Artifacts

After `npm run test:regression`:

- `test-results/blocker-log.json` — timestamped dismiss events per run
- `test-results/skip-report.json` — skipped modules (unchanged)

## Phase B (deferred)

See **`docs/checklist.md`** for the full tracker (deferred partial tests, Phase B items, regression expectations).

- `data-testid` on critical controls in `Pm-Doctor-Portal`
- ZeroStep retry layer for high-churn interactions only
