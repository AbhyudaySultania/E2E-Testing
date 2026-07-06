---
name: generate-regression
description: >-
  Scaffold new rx-pad Playwright regression tests in ai-testing-poc. Use when adding
  E2E coverage for a prescription module, new feature, or user asks to generate/create
  regression test cases. Outputs repo-correct spec, page object methods, test data,
  test-ids, and npm script — not raw Playwright codegen.
---

# Generate regression (ai-testing-poc)

See `docs/skills/generate-regression/SKILL.md` for full instructions.

**Quick start:** User describes new module/feature → read `docs/dev-guide.md` §4 + closest template in `docs/skills/generate-regression/templates.md` → scaffold spec, page object, test data, npm script → validate with `RX_PAD_ENTRY_PATH=walk-in npm run test:regression:<slug>`.
