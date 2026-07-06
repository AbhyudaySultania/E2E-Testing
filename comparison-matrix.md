# AI-Driven E2E Testing — Comparison Matrix

**Target Application:** rx-pad 1.0  
**Evaluation Date:** June 2026

---

## Scoring Methodology

Each framework is scored **1–10** per criterion, then multiplied by the criterion weight to produce a weighted score. Scores reflect fitness for AI-assisted regression testing in a Cursor-based developer workflow.

| Score | Meaning |
|-------|---------|
| 1–3 | Poor — significant gaps or blockers |
| 4–5 | Fair — usable with notable limitations |
| 6–7 | Good — solid capability with some trade-offs |
| 8–9 | Very Good — strong fit with minor gaps |
| 10 | Excellent — best-in-class for this criterion |

---

## Criteria Weights

| Criteria | Weight |
|----------|--------|
| Setup Simplicity | 10 |
| Open Source Maturity | 15 |
| AI Test Generation | 15 |
| Natural Language Actions | 15 |
| Self Healing | 20 |
| Cursor Integration | 10 |
| Regression Stability | 10 |
| Long-Term Maintainability | 5 |
| **Total** | **100** |

---

## Raw Scores (1–10)

| Criteria | Weight | Playwright + Cursor | ZeroStep + Playwright | Midscene.js | CodeceptJS + AI |
|----------|--------|:-------------------:|:---------------------:|:-----------:|:---------------:|
| Setup Simplicity | 10 | 8 | 7 | 5 | 6 |
| Open Source Maturity | 15 | 10 | 6 | 9 | 7 |
| AI Test Generation | 15 | 9 | 7 | 8 | 7 |
| Natural Language Actions | 15 | 7 | 10 | 9 | 6 |
| Self Healing | 20 | 6 | 9 | 10 | 7 |
| Cursor Integration | 10 | 10 | 8 | 7 | 6 |
| Regression Stability | 10 | 9 | 6 | 7 | 7 |
| Long-Term Maintainability | 5 | 8 | 7 | 7 | 6 |
| **Raw Total (/80)** | | **67** | **64** | **62** | **52** |

---

## Weighted Score Calculation

### Framework 1: Playwright + Cursor/Claude Code

| Criteria | Score | Weight | Weighted |
|----------|------:|-------:|---------:|
| Setup Simplicity | 8 | 10 | 80 |
| Open Source Maturity | 10 | 15 | 150 |
| AI Test Generation | 9 | 15 | 135 |
| Natural Language Actions | 7 | 15 | 105 |
| Self Healing | 6 | 20 | 120 |
| Cursor Integration | 10 | 10 | 100 |
| Regression Stability | 9 | 10 | 90 |
| Long-Term Maintainability | 8 | 5 | 40 |
| **Total** | | **100** | **820** |

**Weighted Score: 8.20 / 10**

---

### Framework 2: ZeroStep + Playwright

| Criteria | Score | Weight | Weighted |
|----------|------:|-------:|---------:|
| Setup Simplicity | 7 | 10 | 70 |
| Open Source Maturity | 6 | 15 | 90 |
| AI Test Generation | 7 | 15 | 105 |
| Natural Language Actions | 10 | 15 | 150 |
| Self Healing | 9 | 20 | 180 |
| Cursor Integration | 8 | 10 | 80 |
| Regression Stability | 6 | 10 | 60 |
| Long-Term Maintainability | 7 | 5 | 35 |
| **Total** | | **100** | **770** |

**Weighted Score: 7.70 / 10**

---

### Framework 3: Midscene.js

| Criteria | Score | Weight | Weighted |
|----------|------:|-------:|---------:|
| Setup Simplicity | 5 | 10 | 50 |
| Open Source Maturity | 9 | 15 | 135 |
| AI Test Generation | 8 | 15 | 120 |
| Natural Language Actions | 9 | 15 | 135 |
| Self Healing | 10 | 20 | 200 |
| Cursor Integration | 7 | 10 | 70 |
| Regression Stability | 7 | 10 | 70 |
| Long-Term Maintainability | 7 | 5 | 35 |
| **Total** | | **100** | **815** |

**Weighted Score: 8.15 / 10**

---

### Framework 4: CodeceptJS + AI Features

| Criteria | Score | Weight | Weighted |
|----------|------:|-------:|---------:|
| Setup Simplicity | 6 | 10 | 60 |
| Open Source Maturity | 7 | 15 | 105 |
| AI Test Generation | 7 | 15 | 105 |
| Natural Language Actions | 6 | 15 | 90 |
| Self Healing | 7 | 20 | 140 |
| Cursor Integration | 6 | 10 | 60 |
| Regression Stability | 7 | 10 | 70 |
| Long-Term Maintainability | 6 | 5 | 30 |
| **Total** | | **100** | **660** |

**Weighted Score: 6.60 / 10**

---

## Final Ranking

| Rank | Framework | Weighted Score | Best For |
|:----:|-----------|:--------------:|----------|
| 🥇 **1** | **Playwright + Cursor/Claude Code** | **8.20** | Cursor-native AI test generation, deterministic CI regression, Healer-based maintenance |
| 🥈 **2** | **Midscene.js** | **8.15** | Vision-based self-healing, cross-platform automation, self-hosted AI models |
| 🥉 **3** | **ZeroStep + Playwright** | **7.70** | Runtime natural language actions, fastest resilient test authoring for dynamic UIs |
| **4** | **CodeceptJS + AI** | **6.60** | BDD-style teams, experimental heal recipes, budget-conscious OSS-only approach |

---

## Scoring Rationale

### Setup Simplicity
- **Playwright + Cursor (8):** Well-documented; MCP config is a one-time setup
- **ZeroStep (7):** npm install + API token; minimal config
- **Midscene (5):** Model API configuration, fixture setup, caching, reporter config
- **CodeceptJS (6):** Init wizard + AI provider config + helper selection

### Open Source Maturity
- **Playwright (10):** Fully OSS, Microsoft-backed, massive ecosystem
- **Midscene (9):** Fully OSS, active development, self-hostable models
- **CodeceptJS (7):** OSS framework, but AI features experimental
- **ZeroStep (6):** Client OSS, but AI backend is proprietary SaaS

### AI Test Generation
- **Playwright + Cursor (9):** Planner/Generator agents with live browser context
- **Midscene (8):** Playground, MCP, good prompt-to-test via Cursor
- **ZeroStep (7):** LLM can generate `ai()` calls, but no built-in planner
- **CodeceptJS (7):** `askForPageObject()` and pause-mode generation

### Natural Language Actions
- **ZeroStep (10):** Native `ai()` function — NL at runtime in test code
- **Midscene (9):** `aiAct`, `aiAssert`, `aiQuery` — comprehensive NL API
- **Playwright + Cursor (7):** NL in prompts/plans, not in executed test code
- **CodeceptJS (6):** BDD scenarios + limited `askGpt` helpers

### Self Healing (Highest Weight: 20)
- **Midscene (10):** Vision-based runtime healing with cache fallback
- **ZeroStep (9):** Runtime AI resolution on every step
- **CodeceptJS (7):** Heal recipes with AI (experimental)
- **Playwright + Cursor (6):** Healer agent repairs post-failure, not runtime

### Cursor Integration
- **Playwright + Cursor (10):** Official MCP support, Test Agents, Cursor rules
- **ZeroStep (8):** Simple API for LLM generation; no native MCP
- **Midscene (7):** MCP available; less Cursor-specific documentation
- **CodeceptJS (6):** No MCP; prompt-based generation only

### Regression Stability
- **Playwright + Cursor (9):** Deterministic selectors, fast, no AI variance in CI
- **Midscene (7):** Caching helps; vision models add variance
- **CodeceptJS (7):** Standard locators; heal on failure
- **ZeroStep (6):** AI resolution adds latency and non-determinism

### Long-Term Maintainability
- **Playwright + Cursor (8):** Largest community, standard patterns, Healer support
- **ZeroStep (7):** Prompt maintenance vs selector maintenance trade-off
- **Midscene (7):** Growing community; API still evolving
- **CodeceptJS (6):** Smaller community; experimental AI features

---

## Hybrid Recommendation Score

For rx-pad's prescription workflow, a **hybrid stack** combining the top two frameworks optimizes the weighted criteria:

| Hybrid: Playwright + Cursor + ZeroStep | Estimated Score |
|----------------------------------------|:---------------:|
| Setup Simplicity | 7.5 |
| Open Source Maturity | 8.5 |
| AI Test Generation | 9.5 |
| Natural Language Actions | 9.0 |
| Self Healing | 8.5 |
| Cursor Integration | 10.0 |
| Regression Stability | 8.5 |
| Long-Term Maintainability | 8.0 |
| **Estimated Hybrid Weighted Score** | **8.65 / 10** |

This hybrid approach is recommended for the POC implementation.
