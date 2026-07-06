# Midscene.js Implementation Report — rx-pad AI Testing POC

| Field | Value |
|-------|-------|
| **Project** | `ai-testing-poc` (Tatva rx-pad doctor portal E2E) |
| **Framework** | [Midscene.js](https://midscenejs.com) `@midscene/web` ^1.9.5 + Playwright ^1.60.0 |
| **Model** | `gpt-5.4` (`MIDSCENE_MODEL_FAMILY=gpt-5`) via OpenAI-compatible API |
| **Scenario** | `walk-in-prescription` — walk-in consult → add Para → End Visit → print preview |
| **Environment** | `http://localhost:3000` (local portal) |
| **Report date** | 2026-06-15 |
| **Status** | **POC complete — not recommended for CI regression** |

---

## 1. Executive summary

We implemented a **Midscene-heavy** natural-language test runner for one end-to-end prescription flow. After multiple iteration cycles (false negatives, scroll failures, navigation mis-clicks, and prompt tuning), the scenario **passes reliably** when run locally with a configured vision model.

However, we are **not continuing with Midscene as the primary regression approach** because:

- A **single scenario** costs **~150k–260k tokens** and **~2–4 minutes** wall time per run (vs **~2–3 minutes** for a deterministic Playwright smoke covering the same flow with **zero LLM cost**).
- **8+ debugging iterations** were required to stabilize one flow; each failed run consumed **2×–3× tokens** due to replanning and retries.
- Tests are **non-deterministic** — outcomes depend on vision model interpretation, toast timing, and scroll behavior inside nested prescription pad containers.
- **Operational overhead**: OpenAI API keys, model config, append-only token logs, and **~10 MB HTML reports** per run are unsuitable for daily CI at scale.
- The existing **29-test Playwright regression suite** already passes in **~13–17 minutes** with **$0 inference cost** and is the documented POC recommendation.

**Recommendation (unchanged):** Keep **Playwright + Page Objects** as the regression gate. Retain Midscene artifacts as a **reference POC** for vision-driven NL testing, not as a production test strategy.

---

## 2. Architecture

### 2.1 Design principle

> **AI drives interaction; Playwright verifies outcome.**

| Layer | Responsibility |
|-------|----------------|
| **Midscene** (`ai`, `aiWaitFor`) | All UI actions: dismiss popups, navigate, search patient, scroll, type medicine, click Complete |
| **Playwright** | Auth setup, post-Complete URL wait, final `expect(page).toHaveURL(...)`, debug state capture |
| **Markdown scenario** | Human-readable steps in `tests/ai/scenarios/*.md` |

### 2.2 File map

```
ai-testing-poc/
├── playwright.config.ts              # Midscene merged reporter wired in
├── package.json                      # test:ai, test:ai:headed scripts
├── tests/
│   ├── auth.setup.ts                 # JWT → storageState (not AI)
│   └── ai/
│       ├── midscene.fixture.ts         # PlaywrightAiFixture (replanningCycleLimit: 40)
│       ├── run-scenario-midscene.spec.ts  # Main runner
│       ├── midscene-step-executor.ts   # Routes steps to ai / aiWaitFor + URL guards
│       ├── midscene-prescription-prep.ts # Post-Complete URL wait helpers
│       ├── midscene-debug.ts           # RX_AI_DEBUG step/state logging
│       ├── midscene-env.ts             # MIDSCENE_MODEL_* validation
│       ├── load-scenario.ts            # Parses ## Steps / ## Verify from .md
│       └── scenarios/
│           └── walk-in-prescription.md # 12 NL steps + URL verify
└── midscene_run/                     # Generated at runtime (gitignored)
    ├── report/*.html                 # Vision trace reports (~10 MB each)
    └── log/*.log                     # Token stats, AI calls, planning, etc.
```

### 2.3 NPM scripts

```bash
npm run test:ai          # headless Midscene scenario(s)
npm run test:ai:headed   # headed, workers=1
npm run test:ai:check-model  # connectivity smoke to model API
```

### 2.4 Environment variables

| Variable | Purpose |
|----------|---------|
| `MIDSCENE_MODEL_API_KEY` | OpenAI (or compatible) API key |
| `MIDSCENE_MODEL_BASE_URL` | e.g. `https://api.openai.com/v1` |
| `MIDSCENE_MODEL_NAME` | e.g. `gpt-5.4` |
| `MIDSCENE_MODEL_FAMILY` | e.g. `gpt-5` |
| `RX_AI_SCENARIO` | Filter to one scenario file (without `.md`) |
| `RX_AI_DEBUG` | Step logging (default on; set `0` to disable) |
| `RX_AI_GOAL_RECOVERY` | Continue if goal URL reached despite Midscene error (default on) |
| `DEBUG=midscene:ai:profile` | Per-call token lines in terminal + `ai-profile-stats.log` |
| `RX_PAD_BASE_URL` | Portal URL |
| `RX_PAD_JWT` | Auth token for setup project |

### 2.5 Playwright config integration

```ts
reporter: [
  ['html'],
  ['@midscene/web/playwright-reporter', { type: 'merged' }],
  // ...custom reporters
],
```

Viewport: **1280×720**. Timeout per scenario: **600_000 ms** (10 min).

---

## 3. Scenario: walk-in-prescription

**Title:** Walk-in prescription — add medication and end visit  
**Verify:** `url includes: /prescription_print_view`

### 3.1 Steps (12)

| # | Type | Summary |
|---|------|---------|
| 1 | `ai` | Dismiss premium popups / tours / chat widgets |
| 2 | `ai` | Open Walk-In Consultation via Start Walk-in button |
| 3 | `ai` | Search patient `9821885020` |
| 4 | `ai` | Find patient row Abhyuday Sultania Updated ws |
| 5 | `ai` | Chevron menu → Consult (not SmartRx) |
| 6 | `aiWaitFor` | Prescription pad loaded, Complete button visible |
| 7 | `ai` | **Scroll** prescription content to Medications (Rx) + search field |
| 8 | `aiWaitFor` | Medicine search input visible in viewport |
| 9 | `ai` | Type Para, select first catalog medicine |
| 10 | `aiWaitFor` | Medicine row visible in list |
| 11 | `ai` | Click Complete (do not click Go to Appointment) |
| 12 | `aiWaitFor` | Print preview loaded (skipped if already on URL) |

### 3.2 Hybrid guards (Playwright-only)

1. **`waitForPrintPreviewNavigation`** — After step 11, Playwright waits for `/prescription_print_view` (60s). Detects failure modes: stuck on `/prescription`, or redirected to `/` (appointments) after mis-clicking "Go to Appointment".
2. **`isPrintPreviewWaitStep` short-circuit** — Step 12 skips `aiWaitFor` if URL already correct.
3. **`RX_AI_GOAL_RECOVERY`** — If Midscene throws but goal URL is reached (e.g. transient validation toast), test continues instead of failing.

### 3.3 Evolution during POC

| Iteration | Change | Reason |
|-----------|--------|--------|
| v1 | Basic 10-step scenario | Initial implementation |
| v2 | Added `RX_AI_GOAL_RECOVERY` + debug logging | False negative: validation toast "Please fill your prescription to end visit" while UI actually succeeded |
| v3 | Playwright `preparePrescriptionPadForMedications` scroll prep | Midscene could not scroll nested prescription pad to medicine search |
| v4 | Refined Complete step + step 12 wait | Midscene clicked "Go to Appointment" → stuck on `/` |
| v5 | Fixed `isEndVisitStep` regex | Steps containing word "Complete" in negative instructions triggered URL wait too early |
| v6 | **Removed Playwright scroll prep** | User requirement: AI must scroll itself; strengthened NL steps 7–8 |
| v7 | **Stable passes** | Final architecture validated |

---

## 4. Exact timing — successful runs

Data from Playwright terminal output (`tests/ai/run-scenario-midscene.spec.ts`).

### 4.1 Run A — headed (canonical final run)

| Field | Value |
|-------|-------|
| **Report UUID** | `cb1c4973-fd17-4e30-bd36-df5af2885cf6` |
| **Command** | `DEBUG=midscene:ai:profile RX_AI_SCENARIO=walk-in-prescription npm run test:ai:headed` |
| **Auth setup** | **1.6 s** |
| **Scenario wall time** | **2.0 min** (Playwright annotation) |
| **Total (2 tests)** | **2.1 min** |
| **Result** | **2 passed** |

#### Per-step duration (Midscene)

| Step | Engine | Duration |
|------|--------|----------|
| 1 | ai | 8.7 s |
| 2 | ai | 20.6 s |
| 3 | ai | 21.3 s |
| 4 | ai | 4.5 s |
| 5 | ai | 13.3 s |
| 6 | aiWaitFor | 2.8 s |
| 7 | ai (scroll) | 9.2 s |
| 8 | aiWaitFor | 2.7 s |
| 9 | ai (medicine) | 19.7 s |
| 10 | aiWaitFor | 2.5 s |
| 11 | ai (Complete) | 8.6 s |
| 12 | skipped | 0.0 s |
| **Sum of steps** | | **~114.9 s (~1 min 55 s)** |

**Slowest steps:** 3 (patient search, 21.3 s), 2 (walk-in nav, 20.6 s), 9 (medicine autocomplete, 19.7 s).

**Final state:** `url=http://localhost:3000/prescription_print_view`, toast *"visit ended successfully"*, header *"Go to Appointment"*.

---

### 4.2 Run B — headless (repeat validation)

| Field | Value |
|-------|-------|
| **Report UUID** | `0bebc6bd-704b-415a-b170-2b7c2555b964` |
| **Command** | `RX_AI_SCENARIO=walk-in-prescription npm run test:ai` |
| **Auth setup** | **699 ms** |
| **Scenario wall time** | **1.9 min** |
| **Total (2 tests)** | **1.9 min** |
| **Result** | **2 passed** |

#### Per-step duration (Midscene)

| Step | Engine | Duration |
|------|--------|----------|
| 1 | ai | 19.4 s |
| 2 | ai | 9.7 s |
| 3 | ai | 16.8 s |
| 4 | ai | 3.4 s |
| 5 | ai | 13.3 s |
| 6 | aiWaitFor | 2.3 s |
| 7 | ai (scroll) | 9.0 s |
| 8 | aiWaitFor | 2.3 s |
| 9 | ai (medicine) | 19.6 s |
| 10 | aiWaitFor | 3.6 s |
| 11 | ai (Complete) | 9.0 s |
| 12 | skipped | 0.0 s |
| **Sum of steps** | | **~108.4 s (~1 min 48 s)** |

Step durations vary run-to-run (non-deterministic); total wall time stays **~1.9–2.1 min** for a passing run.

---

### 4.3 Comparison: deterministic Playwright smoke (same flow)

| Metric | Midscene (Run A) | Playwright `test:prescription` |
|--------|------------------|--------------------------------|
| Wall time | **~2.1 min** | **~2–3 min** (documented) |
| LLM API calls | **~20–24** | **0** |
| Token cost | **~150k–180k / run** | **$0** |
| Determinism | Low (vision + NL) | High (locators + APIs) |
| CI readiness | Poor | Production-ready (in 29-test suite) |

Full regression: **29 Playwright tests in ~13–17 min**, **0 tokens**.

---

## 5. Exact token usage

Source: `midscene_run/log/ai-profile-stats.log` (append-only; one line per API call).

Format per line:
```
[timestamp] model, gpt-5.4, mode, gpt-5, prompt-tokens, N, completion-tokens, N, total-tokens, N, cost-ms, N, requestId, req_...
```

### 5.1 Successful runs (final architecture)

| Run | Time window (IST) | API calls | Prompt tokens | Completion tokens | **Total tokens** | Model latency (sum) |
|-----|-------------------|-----------|---------------|-------------------|------------------|---------------------|
| **A (headed)** | `2026-06-15T18:02:41` → `18:04:29` | **24** | **173,737** | **2,863** | **176,600** | 98,442 ms (1.64 min) |
| **B (headless)** | `2026-06-15T18:07:33` → `18:09:17` | **24** | **173,197** | **2,893** | **176,090** | 92,306 ms (1.54 min) |

**Typical passing run:** ~**176,000 total tokens** (~98% prompt, ~2% completion) across **24 API calls**.

At illustrative OpenAI pricing, **~176k tokens per run** is material for a single smoke test repeated on every PR.

### 5.2 Earlier runs (debugging / failures — higher cost)

| Run window (IST) | API calls | Total tokens | Notes |
|------------------|-----------|--------------|-------|
| 15:50–15:55 | 34 | 198,121 | Early failures + retries |
| 16:04–16:07 | 41 | 211,009 | Replanning |
| 16:14–16:19 | 68 | 263,188 | Multiple Midscene aborts |
| 17:00–17:04 | 70 | 260,372 | Scroll / Complete issues |
| 17:09–17:11 | 20 | 149,667 | Shorter partial run |
| 17:16–17:18 | 21 | 151,355 | Near-stable (with Playwright scroll prep) |

**Failed or unstable runs cost 1.5×–3× more tokens** than a clean pass due to extra vision/planning cycles.

### 5.3 Cumulative POC session

| Metric | Value |
|--------|-------|
| Total API calls logged | **302** |
| Log file size | **~60 KB** (`ai-profile-stats.log`) |
| Distinct scenario sessions detected | **8** |

---

## 6. Midscene artifacts (`midscene_run/`)

### 6.1 HTML reports (`midscene_run/report/`)

Interactive vision traces — screenshots, AI planning steps, per-call usage when expanded.

| File | UUID | Size | Last modified (local) |
|------|------|------|---------------------|
| `playwright-AI-(Midscene)--Walk-in-prescription-—-add-medication-and-end-visit__@walk-in-prescription-0bebc6bd-704b-415a-b170-2b7c2555b964.html` | `0bebc6bd-…` | **10.57 MB** | 2026-06-15 18:09:17 |
| `playwright-AI-(Midscene)--Walk-in-prescription-—-add-medication-and-end-visit__@walk-in-prescription-cb1c4973-fd17-4e30-bd36-df5af2885cf6.html` | `cb1c4973-…` | **10.98 MB** | 2026-06-15 18:04:29 |
| `playwright-AI-(Midscene)--Walk-in-prescription-—-add-medication-and-end-visit__@walk-in-prescription-ff5246cd-7617-480c-81da-df3175d6e1b7.html` | `ff5246cd-…` | **9.48 MB** | 2026-06-15 17:18:12 |

**Open latest report:**
```bash
cd ai-testing-poc
open "$(ls -t midscene_run/report/*walk-in-prescription*.html | head -1)"
```

Terminal also prints the full path after each run, e.g.:
```
Midscene - report finalized: .../midscene_run/report/playwright-AI-(Midscene)--Walk-in-prescription-...-cb1c4973-....html
```

### 6.2 Log files (`midscene_run/log/`)

| File | Approx. size | Contents |
|------|--------------|----------|
| `ai-profile-stats.log` | 62 KB | **Token usage per API call** (primary cost audit) |
| `ai-profile-detail.log` | 93 KB | Full OpenAI `usage` JSON (cached tokens, etc.) |
| `ai-call.log` | 228 KB | Request/response payloads |
| `planning.log` | 179 KB | Midscene planning/replanning decisions |
| `device-task-executor.log` | 493 KB | Action execution trace |
| `commonContextParser.log` | 401 KB | UI context parsing |
| `web-page.log` | 140 KB | Page-level Midscene events |
| `agent-task-builder.log` | 188 KB | Task decomposition |
| `task-runner.log` | 29 KB | Task runner state |
| `agent.log` | 7 KB | Agent-level events |
| `ai-config.log` | 133 KB | Model configuration |
| `ai-model-adapter.log` | 1 KB | Adapter init |
| `device-common-action.log` | 6 KB | Click/type/scroll actions |
| `img.log` | 2 KB | Screenshot handling |
| `web-playwright-ai-fixture.log` | 1 KB | Fixture init |

**Sum tokens for a time window:**
```bash
# Edit timestamps to match your run (from terminal clock or first/last line in ai-profile-stats.log)
python3 - <<'PY'
import re
from pathlib import Path
log = Path("midscene_run/log/ai-profile-stats.log").read_text()
start, end = "2026-06-15T18:02:", "2026-06-15T18:04:"
rows = []
for line in log.splitlines():
    if start <= line[1:20] <= end.replace("18:04:", "18:05:"):
        t = re.search(r"total-tokens, (\d+)", line)
        p = re.search(r"prompt-tokens, (\d+)", line)
        c = re.search(r"completion-tokens, (\d+)", line)
        if t: rows.append((int(p.group(1)), int(c.group(1)), int(t.group(1))))
print(f"calls={len(rows)} prompt={sum(r[0] for r in rows):,} completion={sum(r[1] for r in rows):,} total={sum(r[2] for r in rows):,}")
PY
```

---

## 7. Issues encountered (why stabilization took multiple iterations)

### 7.1 False negative — validation toast

- **Symptom:** Test failed on Complete step with *"Please fill your prescription to end visit."*
- **Reality:** Medicine was added; print preview eventually loaded.
- **Cause:** Midscene aborted on transient toast before React state committed `medicationData`; race between autocomplete select and Complete click.
- **Mitigation:** Added steps 10 (wait for medicine row), `RX_AI_GOAL_RECOVERY`, and stricter step 11 wording.

### 7.2 Scrolling — nested prescription pad

- **Symptom:** Midscene could not find "Search Medicines by Name" without manual scroll.
- **Cause:** Medications (Rx) sits below the fold in `.scroll-y-hidden` / `.prescription-wrapper`; vision only sees viewport.
- **Attempted fix:** Playwright `scrollPrescriptionPad` + `scrollIntoViewIfNeeded` before each med step.
- **Final approach:** Removed Playwright scroll; NL steps 7–8 instruct AI to scroll inside prescription body. **Works in final runs** (step 7 ~9 s) but **not guaranteed** on every run or viewport.

### 7.3 Wrong navigation after Complete

- **Symptom:** Test expected `/prescription_print_view` but URL was `/` (appointments dashboard).
- **Cause:** Midscene clicked **"Go to Appointment"** on print preview (or before preview finished) instead of stopping.
- **Mitigation:** Explicit step 11/12 instructions; Playwright `waitForPrintPreviewNavigation` with error message for `/` case.

### 7.4 `isEndVisitStep` false trigger

- **Symptom:** URL wait fired after step 9 while still on `/prescription`.
- **Cause:** Step text *"Do not click Complete yet"* matched `/\bcomplete\b/i`.
- **Fix:** Require step to **start with** `Click` for End Visit detection.

### 7.5 Playwright + Midscene capability gap

- **Warning seen every run:** `waitForNetworkIdle is skipped for Playwright` — Midscene cannot wait for network idle the same way as Puppeteer; occasional timing flakes.

---

## 8. Reasons we are not continuing with this approach

### 8.1 Cost

| Item | Impact |
|------|--------|
| **~176,000 tokens per passing run** | Unsustainable for PR gates (× developers × daily runs) |
| **~260,000 tokens on failed runs** | Debugging is expensive; 8 sessions logged during POC |
| **gpt-5.4 vision pricing** | Dominated by prompt tokens (screenshots embedded in context) |
| **No token budget in CI** | Would require quotas, caching, and cost monitoring |

### 8.2 Time

| Item | Impact |
|------|--------|
| **~2.1 min for 1 scenario** | vs **~16.7 min for 29 deterministic tests** |
| **~1.6 min model latency alone** | API round-trips per vision step |
| **High-variance step times** | Step 1: 8.7 s (run A) vs 19.4 s (run B) — flaky SLA |
| **Human debug time** | Multiple days tuning one markdown file |

### 8.3 Reliability and determinism

| Item | Impact |
|------|--------|
| **Non-deterministic** | Same steps, different durations and occasional mis-clicks |
| **Vision ambiguity** | Similar buttons (Complete vs Go to Appointment; SmartRx vs Consult) |
| **Transient UI state** | Toasts, async saves, autocomplete timing |
| **Scroll in nested containers** | Core rx-pad UX pattern; vision models struggle without helpers |
| **Goal recovery masks failures** | `RX_AI_GOAL_RECOVERY` can hide real regressions |

### 8.4 Operational / engineering

| Item | Impact |
|------|--------|
| **API key management** | `MIDSCENE_MODEL_*` secrets in CI, rotation, per-env config |
| **Model versioning** | `gpt-5.4` behavior can shift; no pinned DOM contract |
| **Large artifacts** | **~10 MB HTML report per run**; verbose logs (**~2 MB+** under `midscene_run/log/`) |
| **Not in regression suite** | Intentionally separate from 29-test gate |
| **Markdown prompt maintenance** | Long, brittle NL steps replace simpler Page Object methods |
| **Hybrid complexity** | Still needs Playwright for auth, URL asserts, and navigation guards |

### 8.5 vs existing POC recommendation

From `research-report.md` and `docs/POC-CONFLUENCE.md`:

- **Primary:** Playwright + Cursor (29 tests, 0 inference cost, CI-proven)
- **Secondary:** ZeroStep for selective brittle demos (~1.2 min, SaaS token)
- **Midscene:** Evaluated; strong vision healing in theory, **not adopted for regression**

Midscene POC **confirms** the research findings: vision-driven NL is valuable for **exploratory** or **demo** flows, not for **repeatable CI regression** on a complex EMR pad.

---

## 9. What worked well (retain as reference)

1. **Markdown scenarios** — Product/QA-readable steps without recompiling tests.
2. **Midscene HTML reports** — Excellent debug UX for understanding *what the model saw*.
3. **Hybrid verify pattern** — AI acts, Playwright asserts URL/outcome.
4. **Debug harness** — `RX_AI_DEBUG`, `capturePageDebugState`, step annotations in Playwright report.
5. **Single-scenario filter** — `RX_AI_SCENARIO=walk-in-prescription` for fast iteration.
6. **Final scroll-via-AI** — Proves Midscene *can* scroll when prompted; removes hidden Playwright dependency.

---

## 10. Commands reference

```bash
cd /Users/abhyudaysultania/tatva/ai-testing-poc

# Run scenario (headed)
DEBUG=midscene:ai:profile \
RX_AI_SCENARIO=walk-in-prescription \
npm run test:ai:headed

# Run scenario (headless)
RX_AI_SCENARIO=walk-in-prescription npm run test:ai

# Open latest HTML vision report
open "$(ls -t midscene_run/report/*walk-in-prescription*.html | head -1)"

# Recommended regression gate (no AI)
CI=1 npm run test:regression
```

---

## 11. Conclusion

The Midscene implementation successfully demonstrates **natural-language, vision-driven E2E** for rx-pad walk-in prescription. The **canonical passing run** (headed, report `cb1c4973`) completed in **2.1 minutes** using **176,600 tokens** across **24 API calls**, ending on `/prescription_print_view`.

We stop here because **cost, latency, non-determinism, and operational overhead** do not justify replacing or augmenting the existing **29-test Playwright regression suite** for daily quality gates. Midscene remains documented as a **completed evaluation** — code and reports preserved under `tests/ai/` and `midscene_run/` for future reference or selective experiments.

---

## Appendix A — Related documents

| Document | Path |
|----------|------|
| Framework comparison | `research-report.md` |
| POC Confluence summary | `docs/POC-CONFLUENCE.md` |
| Developer guide | `README-dev.md` |
| Prescription test spec | `docs/prescription-test-spec.md` |
| Scenario source | `tests/ai/scenarios/walk-in-prescription.md` |

## Appendix B — Package versions

```json
"@midscene/web": "^1.9.5",
"@playwright/test": "^1.60.0"
```
