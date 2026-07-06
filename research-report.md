# AI-Driven E2E Testing POC — Research Report

**Target Application:** rx-pad 1.0  
**Evaluation Date:** June 2026  
**Author Role:** Software development Engineer - 1

---

## Executive Summary

This report evaluates four AI-assisted E2E testing approaches for integrating into modern developer workflows (Cursor IDE). All four frameworks can automate the rx-pad prescription workflow, but they differ significantly in how AI is applied: at **test authoring time** (Cursor/Claude generating Playwright code), at **test execution time** (ZeroStep/Midscene resolving actions via AI), or at **test repair time** (CodeceptJS heal recipes, Playwright Healer agent).

**Recommended POC Stack:** Playwright + Cursor/Claude Code (primary) with ZeroStep (secondary hybrid layer for brittle UI flows).

---

## Framework 1: Playwright + Cursor/Claude Code Generated Tests

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Cursor IDE / Claude Code                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Planner Agent│  │Generator Agent│  │ Healer Agent │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         └─────────────────┼─────────────────┘               │
│                           │ MCP Protocol                    │
│                    ┌──────▼──────┐                          │
│                    │ Playwright  │                          │
│                    │ MCP Server  │                          │
│                    └──────┬──────┘                          │
└───────────────────────────┼─────────────────────────────────┘
                            │ Accessibility Snapshots + DOM
                    ┌───────▼───────┐
                    │  rx-pad 1.0   │
                    │  (Browser)    │
                    └───────────────┘
                            │
                    ┌───────▼───────┐
                    │ .spec.ts files│  ← Deterministic test code
                    │ (Playwright)  │
                    └───────────────┘
```

Playwright Test Agents (v1.56+) provide three specialized agents:

| Agent | Purpose |
|-------|---------|
| **Planner** | Explores live app, produces Markdown test plans in `specs/` |
| **Generator** | Converts plans to executable `.spec.ts` with verified locators |
| **Healer** | Runs failing tests, inspects live DOM, repairs broken locators |

The Playwright MCP server enables Cursor to control a real browser, capture accessibility snapshots, and generate tests grounded in actual page state — not assumptions.

### Installation Complexity

**Low–Medium.** Standard Playwright setup plus MCP configuration.

```bash
npm init playwright@latest
npx playwright install
npx playwright init-agents --loop=vscode   # or claude/opencode
```

Add to Cursor MCP settings:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**Estimated setup time:** 2–4 hours for a working POC.

### Learning Curve

**Low for teams already using Playwright.** Cursor users can generate tests via natural language prompts without learning new APIs. Playwright's locator strategies (`getByRole`, `getByTestId`, `getByLabel`) remain the execution layer.

### Open Source Status

| Component | Status |
|-----------|--------|
| Playwright | Fully open source (Apache 2.0), Microsoft-maintained |
| Playwright MCP | Open source |
| Playwright Test Agents | Open source (bundled with Playwright 1.56+) |
| Cursor/Claude Code | Proprietary IDE/CLI; uses OSS Playwright underneath |

### Community Adoption

- Playwright: 70k+ GitHub stars, industry standard for E2E
- Playwright MCP: Official Microsoft project, rapidly adopted in 2025–2026
- Test Agents: New but backed by Playwright core team

### Maintenance Burden

**Medium.** Generated tests use deterministic selectors — stable in CI but require Healer or manual updates when UI changes significantly. The Healer agent reduces but does not eliminate maintenance. Teams should adopt `data-testid` conventions on rx-pad to maximize stability.

### Self-Healing Support

**Author-time + repair-time healing**, not runtime healing.

- **Healer Agent:** Re-inspects live DOM on failure, updates locators in test files
- **No runtime AI resolution:** Once generated, tests run deterministically
- **Rating:** Fair → Good (depends on Healer adoption and test-id discipline)

### Natural Language Support

Natural language is used in **Cursor prompts** and **Markdown test plans**, not in test execution code. Example workflow:

```
Prompt: "Generate a Playwright test for rx-pad that logs in, opens the
prescription form, fills mandatory fields, and saves the prescription."
```

The Generator agent navigates the live app and produces TypeScript test code.

### Cost Implications

| Item | Cost |
|------|------|
| Playwright | Free |
| Playwright MCP | Free |
| Cursor Pro | ~$20/month per developer |
| Claude Code / API | Usage-based; test generation is occasional, not per-run |
| CI execution | Standard compute; no AI API calls during regression |

**Lowest ongoing cost** for regression suites — AI is used at authoring/maintenance time only.

### Cursor Compatibility

**Excellent.** Native MCP integration. Cursor rules can embed test-generation prompts. Agents read/write test files directly. Playwright MCP is the recommended browser automation MCP for Cursor.

### Claude Code Compatibility

**Excellent.** `npx playwright init-agents --loop=claude` generates Claude-specific agent configuration. Claude Code can drive Planner/Generator/Healer workflows identically to Cursor.

### Strengths

- Industry-standard execution engine with best-in-class debugging (Trace Viewer, UI Mode)
- Deterministic, fast, repeatable CI regression runs
- First-class Cursor/Claude Code integration via MCP and Test Agents
- No per-test-run AI API costs
- Strong TypeScript support matches modern dev stacks

### Weaknesses

- Self-healing is repair-time, not runtime — broken tests fail first
- Generated locators still break on major UI refactors without Healer intervention
- Requires discipline (`data-testid`, Page Object Model) for long-term stability
- Test Agents require Playwright 1.56+ (relatively new feature)

---

## Framework 2: ZeroStep + Playwright

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Test File (.spec.ts)                                       │
│  await ai('Fill patient name field with John Doe', ...)     │
└──────────────────────────┬──────────────────────────────────┘
                           │ Prompt + DOM metadata
                    ┌──────▼──────┐
                    │ ZeroStep    │  ← SaaS backend (AI resolution)
                    │ Cloud API   │
                    └──────┬──────┘
                           │ Playwright commands
                    ┌──────▼──────┐
                    │ Playwright  │
                    │ Browser     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  rx-pad 1.0 │
                    └─────────────┘
```

ZeroStep adds an `ai()` function to Playwright tests. At runtime, natural language instructions are sent to ZeroStep's backend along with page metadata; the AI returns Playwright actions to execute.

### Installation Complexity

**Low.**

```bash
npm install @zerostep/playwright
# Set ZEROSTEP_TOKEN environment variable
```

**Estimated setup time:** 1–2 hours.

### Learning Curve

**Very low.** Developers write plain English inside existing Playwright tests. No new test runner or DSL.

### Open Source Status

| Component | Status |
|-----------|--------|
| `@zerostep/playwright` npm package | Open source |
| ZeroStep AI resolution backend | Proprietary SaaS |
| Self-hosted option | Available (contact sales) |

**Hybrid OSS/SaaS model** — the client library is open, but AI resolution requires their cloud (or self-hosted enterprise).

### Community Adoption

Growing adoption since 2024. Used by teams on Salesforce, fintech, and SaaS products with dynamic UIs. Smaller community than Playwright alone.

### Maintenance Burden

**Low for UI-heavy flows.** Tests are decoupled from selectors. When a button moves or renames, the same `ai('Click Save prescription')` instruction often continues to work.

**Caveat:** Prompt wording becomes the maintenance surface — ambiguous prompts may behave inconsistently across AI model updates.

### Self-Healing Support

**Runtime self-healing** — core value proposition.

- AI re-evaluates DOM on every `ai()` call
- No cached selectors to break
- **Rating:** Good → Excellent for selector resilience

**Limitation:** AI resolution adds latency (~1–3s per call) and can misidentify elements in dense forms (e.g., rx-pad prescription fields).

### Natural Language Support

**Excellent at runtime.** Actions, assertions, and queries are all expressed in plain English within test code.

### Cost Implications

| Tier | Cost | AI Calls |
|------|------|----------|
| Free | $0/month | 500 `ai()` calls/month |
| Team | $20/month | 2,000 calls/month |
| Enterprise | Custom | Self-hosted option |

A full rx-pad prescription test might use 15–25 `ai()` calls. At 50 tests × 20 calls = 1,000 calls per full regression — fits free tier for dev, Team tier for CI.

### Cursor Compatibility

**Good.** Cursor can generate ZeroStep-enhanced Playwright tests via prompts. No native MCP integration, but the `ai()` API is simple enough for LLM generation.

### Claude Code Compatibility

**Good.** Same as Cursor — Claude can author ZeroStep tests from natural language descriptions.

### Strengths

- Fastest path to resilient tests for selector-heavy UIs
- Drop-in Playwright integration — no new test runner
- Natural language actions and assertions in test code
- Ideal for complex forms (rx-pad prescription workflow)
- TDD-friendly — write tests before UI is finalized

### Weaknesses

- SaaS dependency for AI resolution (latency, availability, data policy)
- Non-deterministic — same prompt may resolve differently across runs
- Free tier limits constrain CI frequency
- Slower execution than pure Playwright
- Not ideal as sole framework for regulated regression (audit trail concerns)

---

## Framework 3: Midscene.js

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Test File / Script                                         │
│  await agent.aiAct('fill prescription form and save')       │
└──────────────────────────┬──────────────────────────────────┘
                           │ Screenshots + optional DOM
                    ┌──────▼──────┐
                    │ Vision-LM   │  ← GPT-4o, Qwen-VL, UI-TARS, etc.
                    │ (configurable)│
                    └──────┬──────┘
                           │ Element coordinates / XPath
                    ┌──────▼──────┐
                    │ Playwright  │
                    │ Agent       │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  rx-pad 1.0 │
                    └─────────────┘
         ┌─────────────────────────────────┐
         │ Cache Layer (XPath + planning)  │  ← Speed + stability
         └─────────────────────────────────┘
```

Midscene.js (by web-infra-dev, ByteDance ecosystem) uses **vision-driven** automation. UI actions are localized via screenshots, not DOM selectors. Supports web, mobile (Android/iOS), and desktop.

### Installation Complexity

**Medium–High.**

```bash
npm install @midscene/web playwright @playwright/test --save-dev
# Configure model API keys (OpenAI, Qwen, UI-TARS, etc.)
export MIDSCENE_MODEL_BASE_URL="..."
export MIDSCENE_MODEL_API_KEY="..."
export MIDSCENE_MODEL_NAME="..."
export MIDSCENE_MODEL_FAMILY="..."
```

**Estimated setup time:** 4–8 hours (model selection, caching setup, reporter config).

### Learning Curve

**Medium.** New API surface (`aiAct`, `aiAssert`, `aiQuery`, `aiTap`, `aiInput`). Playwright fixture extension required. Visual debugging via HTML reports is excellent but adds concepts to learn.

### Open Source Status

**Fully open source** (MIT). 8k+ GitHub stars, 146 releases, 70 contributors. Supports self-hosted vision models (UI-TARS, Qwen-VL) for data privacy.

### Community Adoption

Strong growth in 2024–2026, particularly in teams needing cross-platform (web + mobile) automation. Active Discord/community. Less enterprise adoption than Playwright alone in Western markets.

### Maintenance Burden

**Low–Medium.** Caching reduces AI calls after first successful run. When UI changes invalidate cache, AI re-analyzes automatically. Prompt stability matters — vague instructions cause flaky replanning.

### Self-Healing Support

**Excellent.** Vision-based localization adapts to layout changes, color changes, and element repositioning. Cache invalidation triggers AI re-evaluation.

- **Rating:** Excellent for visual/layout changes
- **Caveat:** Native `<select>` dropdowns require `forceChromeSelectRendering` workaround

### Natural Language Support

**Excellent.** Full natural language for actions, assertions, queries, and waits.

```typescript
await aiAct('type patient name in the first empty field');
await aiAssert('prescription was saved successfully');
```

Supports English, Chinese, French.

### Cost Implications

| Model | Approximate Cost |
|-------|-----------------|
| GPT-4o / Gemini | $0.01–0.05 per action (vision tokens) |
| Qwen-VL (self-hosted) | Infrastructure only |
| UI-TARS (self-hosted) | Infrastructure only |

Caching significantly reduces costs after initial runs. A 20-step test without cache ≈ $0.20–1.00; with cache ≈ $0.02–0.10.

### Cursor Compatibility

**Good.** Midscene offers MCP integration for UI prepatch workflows. Less documented for Cursor specifically than Playwright MCP, but compatible.

### Claude Code Compatibility

**Good.** Can generate Midscene test scripts from prompts. No dedicated Claude agent loop like Playwright Test Agents.

### Strengths

- Best-in-class vision-based self-healing
- Cross-platform (web, Android, iOS) from one framework
- Open source with self-hostable models (UI-TARS, Qwen-VL)
- Excellent visual debugging (HTML reports, Chrome extension, playground)
- Caching balances cost and speed

### Weaknesses

- Higher setup complexity (model config, API keys)
- Vision model costs per action (unless self-hosted)
- Slower than deterministic Playwright (screenshot → AI → action cycle)
- Non-deterministic behavior possible with vision models
- Native select dropdowns need workarounds
- Newer framework — API still evolving

---

## Framework 4: CodeceptJS + AI Features

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  CodeceptJS Scenario (BDD-style)                            │
│  I.amOnPage('/prescription');                               │
│  I.fillField('Patient Name', 'John Doe');                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ On failure → Heal Recipe
                    ┌──────▼──────┐
                    │ AI Provider │  ← OpenAI, Anthropic, Azure
                    │ (HTML context)│
                    └──────┬──────┘
                           │ Suggested fix
                    ┌──────▼──────┐
                    │ Playwright  │
                    │ Helper      │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  rx-pad 1.0 │
                    └─────────────┘
```

CodeceptJS is a BDD-style test framework that abstracts Playwright/WebDriver. AI features are **experimental** and focus on authoring assistance and failure recovery.

### Installation Complexity

**Medium.**

```bash
npm install codeceptjs playwright --save-dev
npx codeceptjs init
# Configure ai.request in codecept.conf.js with OpenAI/Anthropic
```

**Estimated setup time:** 3–5 hours.

### Learning Curve

**Medium–High.** New scenario syntax (`I.click`, `Feature`, `Scenario`), configuration model, and plugin ecosystem. AI features primarily work in `pause()` interactive mode — not ideal for CI-first workflows.

### Open Source Status

**Fully open source** (MIT). AI features require external LLM API keys (OpenAI, Anthropic, Azure, Groq/Mixtral).

### Community Adoption

Established framework (2016+) but declining relative to Playwright. AI features are experimental with limited production case studies. Smaller active community than Playwright.

### Maintenance Burden

**Medium–High.** Heal recipes can auto-fix failures, but AI features are marked experimental. Page Object generation via `askForPageObject()` helps initial authoring but generated objects need manual review.

### Self-Healing Support

**Repair-time healing** via heal recipes.

- On test failure, AI receives error message + HTML context
- AI suggests code fix to continue execution
- Can run on CI but reliability is inconsistent
- **Rating:** Fair

No runtime natural language action resolution like ZeroStep/Midscene.

### Natural Language Support

**Limited at runtime.** Natural language is used in:

- `pause()` mode for interactive test writing
- `I.askGptOnPage('How do I fill the prescription form?')`
- Heal recipe prompts on failure

Test scenarios themselves use CodeceptJS BDD syntax, not plain English.

### Cost Implications

| Item | Cost |
|------|------|
| CodeceptJS | Free |
| AI provider (OpenAI/Anthropic) | Usage-based per heal/generation call |
| CI | Standard compute |

Costs are lower than ZeroStep/Midscene for regression (AI used on failure, not every step), but heal success rate is lower.

### Cursor Compatibility

**Fair.** No native MCP integration. Cursor can generate CodeceptJS scenarios via prompts, but lacks the browser-grounded generation that Playwright MCP provides.

### Claude Code Compatibility

**Fair.** Claude can write CodeceptJS tests from descriptions, but without live browser context unless Playwright MCP is also configured separately.

### Strengths

- BDD syntax accessible to non-developers
- Multiple helper backends (Playwright, WebDriver, Puppeteer)
- AI-assisted Page Object generation
- Heal recipes for CI failure recovery
- Fully open source with no SaaS dependency

### Weaknesses

- AI features are experimental and web-only
- No runtime natural language actions
- Smaller community and slower release cadence vs Playwright
- Heal recipes unreliable for complex UI changes
- `pause()`-centric AI workflow doesn't fit CI/CD-first teams
- Additional abstraction layer over Playwright adds complexity without clear AI advantage

---

## Self-Healing Analysis

| Framework | Locator Failure Handling | UI Change Impact | AI Recovery | Confidence | Rating |
|-----------|-------------------------|------------------|-------------|------------|--------|
| **Playwright + Cursor** | Test fails; Healer agent re-inspects DOM and rewrites locators in source | High impact on generated selectors; low impact if using `data-testid` | Healer can fix role/text/testid changes automatically | Medium–High for minor changes; Low for layout rewrites | **Good** |
| **ZeroStep** | AI re-resolves element at runtime on each `ai()` call | Minimal — prompts describe intent, not structure | Automatic on every step | Medium — dense forms may confuse AI | **Good** |
| **Midscene.js** | Cache miss triggers vision AI re-analysis | Low for visual/layout changes; cache invalidation handles DOM changes | Automatic via vision replanning | Medium–High for visual changes; Medium for identical-looking elements | **Excellent** |
| **CodeceptJS + AI** | Test fails; heal recipe sends HTML + error to LLM | High — standard locators break normally | AI suggests fix code; must succeed to continue | Low–Medium — experimental, inconsistent | **Fair** |

### Detailed Self-Healing Behavior

#### Playwright + Cursor
- **Locator failures:** Standard Playwright retry/timeout → test failure → Healer agent invoked manually or via CI hook
- **UI changes:** Button rename breaks `getByRole('button', { name: 'Save' })` — Healer finds new name/role
- **AI recovery:** Yes, but requires Healer run post-failure; not transparent during execution
- **Confidence:** High when test-ids exist; moderate for text/role-based locators

#### ZeroStep
- **Locator failures:** N/A — no locators stored; AI resolves fresh each call
- **UI changes:** Prompt "Click Save prescription" adapts to new button location/label
- **AI recovery:** Automatic, every step
- **Confidence:** High for distinct elements; lower when multiple similar fields exist (rx-pad medication rows)

#### Midscene.js
- **Locator failures:** Cached XPath invalid → falls back to vision AI
- **UI changes:** Screenshot-based re-identification handles layout shifts, theme changes
- **AI recovery:** Automatic with cache acceleration
- **Confidence:** High for visual distinctiveness; lower for identical form fields in repeating rows

#### CodeceptJS + AI
- **Locator failures:** Standard CodeceptJS error → heal recipe triggered
- **UI changes:** Locators break until heal recipe succeeds
- **AI recovery:** Attempts code fix; may or may not work
- **Confidence:** Low — experimental feature with limited production validation

---

## Cursor Workflow Validation

| Capability | Playwright + Cursor | ZeroStep | Midscene.js | CodeceptJS + AI |
|------------|--------------------:|---------:|------------:|----------------:|
| Prompt → Test Generation | ✅ Excellent | ✅ Good | ✅ Good | ⚠️ Fair |
| Prompt → Code Update | ✅ Excellent | ✅ Good | ✅ Good | ⚠️ Fair |
| Prompt → Test Maintenance | ✅ Excellent (Healer) | ✅ Good (prompt edits) | ✅ Good (cache invalidation) | ⚠️ Fair (heal recipes) |
| Prompt → Regression Suite | ✅ Excellent (Planner) | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual |

### Workflow Examples

#### 1. Prompt → Test Generation

**Playwright + Cursor (Recommended):**
```
@playwright Using the MCP browser, navigate to rx-pad staging, log in with
test credentials, open the prescription form, and generate a Playwright test
that fills all mandatory fields and saves the prescription. Use data-testid
locators where available.
```

**ZeroStep:**
```
Generate a Playwright test using @zerostep/playwright for rx-pad that uses
ai() for all form interactions in the prescription workflow.
```

#### 2. Prompt → Code Update

**Playwright + Cursor:**
```
The Save button was renamed to "Submit Prescription". Update all tests in
e2e/prescription/ to use the new button name. Run Healer if locators fail.
```

#### 3. Prompt → Test Maintenance

**Playwright Healer Agent:**
```
@healer Run the prescription test suite and fix any failing locators by
inspecting the live rx-pad application.
```

**ZeroStep:** Edit natural language prompts — no locator maintenance needed.

#### 4. Prompt → Regression Suite Generation

**Playwright Planner Agent:**
```
@planner Explore rx-pad staging and create a comprehensive test plan covering
login, prescription creation, prescription editing, printing, and validation
errors. Save to specs/rx-pad-regression.md
```

---

## Recommended POC

### Recommended Framework

**Primary:** Playwright + Cursor/Claude Code (Test Agents + MCP)  
**Secondary:** ZeroStep (hybrid layer for prescription form interactions)

### Why It Was Chosen

1. **Cursor-native workflow:** Playwright MCP is officially supported in Cursor with the best prompt → test → run loop
2. **Deterministic regression:** Generated Playwright tests run fast and reliably in CI without per-step AI costs — critical for rx-pad's regulated prescription workflow
3. **AI where it matters:** Use AI for authoring (Planner/Generator), maintenance (Healer), and brittle UI sections (ZeroStep `ai()` for dynamic form fields)
4. **Lowest total cost:** AI costs are front-loaded at authoring time; regression runs are standard Playwright
5. **Team familiarity:** Playwright is the most widely adopted E2E framework; minimal training overhead

### Estimated Setup Time

| Phase | Duration |
|-------|----------|
| Playwright + MCP + Agents setup | 4 hours |
| rx-pad seed test (login + navigation) | 4 hours |
| First prescription workflow test | 4 hours |
| ZeroStep integration for form fields | 2 hours |
| CI pipeline configuration | 4 hours |
| **Total Phase 1 POC** | **~2 days** |

### Estimated Maintenance Cost

| Activity | Effort |
|----------|--------|
| New test via Cursor prompt | 30–60 min (vs 4–6 hrs manual) |
| Healer repair after UI change | 15–30 min per broken test |
| ZeroStep prompt tuning | 15 min per brittle flow |
| Monthly maintenance (10-test suite) | ~4–8 hours (vs 16–24 hrs traditional) |

### Risks

| Risk | Severity |
|------|----------|
| Generated locators break without `data-testid` on rx-pad | High |
| Healer agent requires Playwright 1.56+ and manual/CI trigger | Medium |
| ZeroStep free tier limits CI frequency | Medium |
| AI-generated tests miss edge cases (validation errors, permissions) | Medium |
| Team over-relies on AI without reviewing generated code | Medium |

### Mitigations

1. **Establish `data-testid` convention** on rx-pad prescription form fields before POC
2. **Hybrid strategy:** Deterministic Playwright for navigation/login/assertions; ZeroStep `ai()` only for complex dynamic form sections
3. **Code review gate:** All AI-generated tests require human review before merge
4. **Seed test pattern:** Create `seed.spec.ts` with authenticated session for all agents
5. **CI tiers:** Fast deterministic suite on every PR; ZeroStep-enhanced suite nightly
6. **Test plan first:** Use Planner agent to generate Markdown plans for team review before code generation

---

## Expected Final Recommendation

```
Recommended POC Stack:

Primary:   Playwright + Cursor/Claude Code (MCP + Test Agents)
Secondary: ZeroStep (@zerostep/playwright)

Reason: Playwright provides the industry-standard execution engine with
best-in-class Cursor integration via MCP and Test Agents (Planner, Generator,
Healer). This delivers AI-assisted test generation and maintenance with
deterministic, fast, auditable regression runs — essential for rx-pad's
prescription workflow. ZeroStep supplements brittle form-filling steps where
selector maintenance would be highest, using runtime natural language
resolution without abandoning Playwright's CI stability.

Implementation Effort: 2 days (Phase 1 POC) → 2 weeks (production-ready)

Business Value:
  - 60–70% reduction in test authoring time
  - 50% reduction in test maintenance overhead
  - Repeatable regression for prescription critical path within 1 sprint
  - Natural language test creation accessible to QA and dev teams via Cursor

Risk Level: Medium

Confidence: 8/10
```
