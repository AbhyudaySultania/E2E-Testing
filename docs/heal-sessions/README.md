# Heal sessions archive

Permanent records of regression heal loop runs.

Each session produces:

- `YYYY-MM-DD-HHmm-<spec-slug>.md` — analysis, classification, approval notes
- `YYYY-MM-DD-HHmm-<spec-slug>/proposed.patch` — unified diff (paste after Cursor review)
- Artifacts live under `test-results/heal/latest/` (gitignored, overwritten each run)

See `docs/heal-loop.md` for the full workflow.
