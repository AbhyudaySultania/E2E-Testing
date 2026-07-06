import { loadScenarios } from './load-scenario';
import { executeMidsceneStep } from './midscene-step-executor';
import { test, expect } from './midscene.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { AppShellPage } from '../pages/app-shell.page';
import { isMidsceneConfigured, midsceneSkipReason } from './midscene-env';
import {
  capturePageDebugState,
  isScenarioGoalUrl,
  logMidsceneStepBoundary,
} from './midscene-debug';

const scenarios = loadScenarios();
const midsceneReady = isMidsceneConfigured();

if (scenarios.length > 0 && !midsceneReady) {
  console.warn(`\n[test:ai] SKIPPED — ${midsceneSkipReason().replace(/\n/g, '\n[test:ai] ')}\n`);
}

if (scenarios.length === 0) {
  test.describe('AI (Midscene) natural-language scenarios', () => {
    test('no scenarios loaded', () => {
      const hint = process.env.RX_AI_SCENARIO?.trim()
        ? `RX_AI_SCENARIO="${process.env.RX_AI_SCENARIO}" did not match any file in tests/ai/scenarios/`
        : 'Add a .md file under tests/ai/scenarios/ with ## Steps';
      test.skip(true, hint);
    });
  });
}

for (const scenario of scenarios) {
  test.describe(`AI (Midscene): ${scenario.title}`, () => {
    test.skip(!midsceneReady, midsceneSkipReason());

    test(`@${scenario.id}`, async ({ page, ai, aiWaitFor }) => {
      test.setTimeout(600_000);

      const dashboard = new DashboardPage(page);
      const appShell = new AppShellPage(page);

      await dashboard.goto();
      await appShell.assertAuthenticated();
      await capturePageDebugState(page, 'after-auth');

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        const stepNo = i + 1;

        test.info().annotations.push({
          type: 'midscene-step',
          description: `${stepNo}. ${step}`,
        });

        logMidsceneStepBoundary('start', stepNo, step);
        await capturePageDebugState(page, `before-${stepNo}`);

        const started = Date.now();

        try {
          await test.step(`Midscene ${stepNo}/${scenario.steps.length}`, async () => {
            await executeMidsceneStep(step, ai, aiWaitFor, { stepNo, page });
          });
        } catch (error) {
          await capturePageDebugState(page, `error-${stepNo}`);
          logMidsceneStepBoundary('fail', stepNo, step, Date.now() - started, error);

          // Midscene may abort after a transient validation toast even when the flow later succeeds.
          if (
            isScenarioGoalUrl(page, scenario.verify?.urlIncludes) &&
            process.env.RX_AI_GOAL_RECOVERY !== '0'
          ) {
            console.warn(
              `[test:ai][step ${stepNo}] Midscene error but goal URL already reached — continuing (set RX_AI_GOAL_RECOVERY=0 to disable)`,
            );
            continue;
          }

          throw error;
        }
      }

      await capturePageDebugState(page, 'before-verify');

      if (scenario.verify?.urlIncludes) {
        const fragment = scenario.verify.urlIncludes.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );
        await expect(page).toHaveURL(new RegExp(fragment), { timeout: 60_000 });
      }

      console.log('[test:ai] scenario completed — see midscene_run/report/ for vision trace');
    });
  });
}
