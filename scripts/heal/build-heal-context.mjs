import fs from 'node:fs';
import path from 'node:path';
import { PATHS, readJson, log } from './lib.mjs';
import { AGENT_PROMPT } from './lib.mjs';

const CURRENT_SESSION = path.join(PATHS.sessionsDir, 'current-session.md');

/**
 * Build agent-optimized current-session.md (V2).
 */
export function buildHealContext(session, classification) {
  const failure = readJson(path.join(PATHS.latestDir, 'failure.json')) ?? {};
  const errCtxPath = path.join(PATHS.latestDir, 'error-context.md');
  const errCtx = fs.existsSync(errCtxPath)
    ? fs.readFileSync(errCtxPath, 'utf-8').slice(0, 8000)
    : '_No error-context.md_';

  const portalCommits = session.portal_commits_since_last_green?.length
    ? session.portal_commits_since_last_green.map((c) => `- ${c}`).join('\n')
    : '_None since last green_';

  const lastGreenSummary = session.last_green
    ? `- Recorded: ${session.last_green.recordedAt}\n- Portal: ${session.last_green.portal?.branch ?? '?'} @ ${session.last_green.portal?.commit?.slice(0, 7) ?? '?'}\n- URL: ${session.last_green.environment?.RX_PAD_BASE_URL ?? '?'}`
    : '_No baseline — run ground truth after heal_';

  const md = `# Heal session (current) — V2

> **Agent:** invoke skill \`heal-regression\`. This file is pre-built context — do not ask the user to assemble artifacts manually.

## Agent prompt (paste if hook did not fire)

\`\`\`
${AGENT_PROMPT}
\`\`\`

## Failure summary

| Field | Value |
|-------|-------|
| Session ID | \`${session.session_id}\` |
| Spec | \`${session.failed_spec}\` |
| Test | ${session.failed_test_title} |
| Hard failures in run | ${session.regression_failure_count} |
| Timestamp | ${session.timestamp} |

### Error

\`\`\`
${session.failure_error ?? failure.error ?? 'unknown'}
\`\`\`

## Classification

| Field | Value |
|-------|-------|
| Label | **${classification.label}** |
| Confidence | **${classification.confidence}** (${classification.confidenceTier}) |
| Recommended | ${classification.recommendedAction} |

### Evidence

${classification.evidence.map((e) => `- ${e}`).join('\n')}

${classification.confidence < 70 ? '\n> **LOW CONFIDENCE** — extra terminal approval required at apply time. Prefer portal fix if this is a business/API failure.\n' : ''}

## Artifacts

| Artifact | Path |
|----------|------|
| heal-session.json | \`test-results/heal/latest/heal-session.json\` |
| failure.json | \`test-results/heal/latest/failure.json\` |
| classification.json | \`test-results/heal/latest/classification.json\` |
| trace | ${session.trace_path ?? '_none_'} |
| screenshots | ${session.screenshot_paths?.join(', ') || '_none_'} |
| proposed patch (write here) | \`${session.proposed_patch_path}\` |

## Baseline (last green)

${lastGreenSummary}

### Portal commits since last green

${portalCommits}

## Allowed edit locations (ai-testing-poc only)

${session.allowed_edit_roots.map((r) => `- \`${r}\``).join('\n')}

**Never edit:** \`Pm-Doctor-Portal/\`, \`.env\`, PDF/API contract expectations without explicit approval.

## Hard rules

${session.hard_rules.map((r) => `- ${r}`).join('\n')}

## Heal order

1. \`tests/fixtures/ui-blockers.ts\` + \`tests/helpers/ui-blocker-guard.ts\` — popups/overlays
2. \`clickResilient\` — intercepted clicks
3. \`tests/pages/*.page.ts\` — locators (\`rx-*\` testids preferred)
4. Assertions — **only** with explicit user approval + documented business rule change

## Agent steps

1. Read artifacts above + failing spec/page object
2. Read portal source **for context only** (do not edit)
3. Ask user: UI change → update tests, or portal bug?
4. Write unified diff to \`${session.proposed_patch_path}\`
5. Re-run failed spec: \`CI=1 npx playwright test ${session.failed_spec} --reporter=list\`
6. Tell user: \`npm run test:heal:apply\` when patch is ready

## Error context (excerpt)

\`\`\`
${errCtx}
\`\`\`
`;

  fs.mkdirSync(PATHS.sessionsDir, { recursive: true });
  fs.writeFileSync(CURRENT_SESSION, md, 'utf-8');
  log(`current-session → ${CURRENT_SESSION}`);
  return CURRENT_SESSION;
}
