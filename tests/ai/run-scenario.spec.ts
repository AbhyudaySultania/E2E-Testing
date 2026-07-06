import { test, expect } from '@playwright/test';
import { test as playwrightTest } from '@playwright/test';
import { loadScenarios } from './load-scenario';
import { AppShellPage } from '../pages/app-shell.page';
import { DashboardPage } from '../pages/dashboard.page';
import { installUiBlockerGuard } from '../helpers/ui-blocker-guard';
import { executeScenarioStep } from './step-executor';

const scenarios = loadScenarios();

function requireZeroStepToken() {
  if (!process.env.ZEROSTEP_TOKEN?.trim()) {
    test.skip(
      true,
      'ZEROSTEP_TOKEN is required for AI scenarios. Add it to .env — see .env.example',
    );
  }
}

if (scenarios.length === 0) {
  test.describe('AI natural-language scenarios', () => {
    test('no scenarios loaded', () => {
      const hint = process.env.RX_AI_SCENARIO?.trim()
        ? `RX_AI_SCENARIO="${process.env.RX_AI_SCENARIO}" did not match any file in tests/ai/scenarios/`
        : 'Add a .md file under tests/ai/scenarios/ with ## Steps';
      test.skip(true, hint);
    });
  });
}

for (const scenario of scenarios) {
  test.describe(`AI: ${scenario.title}`, () => {
    test(`@${scenario.id}`, async ({ page }) => {
      test.setTimeout(300_000);
      requireZeroStepToken();

      const aiCtx = { page, test: playwrightTest };
      await installUiBlockerGuard(page);

      const appShell = new AppShellPage(page);
      const dashboard = new DashboardPage(page);

      await dashboard.goto();
      await appShell.assertAuthenticated();
      await appShell.dismissBlockingOverlays('ai-pre');

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        test.info().annotations.push({
          type: 'ai-step',
          description: `${i + 1}. ${step}`,
        });

        await appShell.dismissBlockingOverlays(`ai-step-${i + 1}`);
        await executeScenarioStep(step, page, aiCtx);
      }

      if (scenario.verify?.urlIncludes) {
        const fragment = scenario.verify.urlIncludes.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );
        await expect(page).toHaveURL(new RegExp(fragment), { timeout: 30_000 });
      }
    });
  });
}
