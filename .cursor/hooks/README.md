# Cursor hooks (Heal V2)

**Location:** `ai-testing-poc/.cursor/` — hooks live here because the heal skill and test suite are in this repo (not Pm-Doctor-Portal).

**Local only:** These files are for your machine. Add to `.gitignore` or do not push until you want team-wide hooks.

## What fires

- `afterFileEdit` → `on-heal-session.sh` when heal-related files are edited
- `run-regression-heal` also runs `notify-agent.mjs` after writing `current-session.md`

## Enable

1. Open **ai-testing-poc** as the Cursor workspace (or ensure hooks load from this folder)
2. `chmod +x .cursor/hooks/on-heal-session.sh`
3. Run `CI=1 npm run test:regression:heal` on a failure

## Agent prompt

Paste from terminal output or use skill `heal-regression` — context is in `docs/heal-sessions/current-session.md`.
