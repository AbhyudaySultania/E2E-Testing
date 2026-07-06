# Generate regression — spec templates

Copy closest pattern; replace `myModule`, slugs, and E2E IDs.

## A — Search + autocomplete (investigation / diagnosis)

```typescript
import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import {
  entryPathTitle,
  finishRegressionVisit,
  setupRegressionSession,
} from '../helpers/regression.harness';
import { runEditAndRepeatRxValidation } from '../helpers/module-regression.harness';
import { myModuleMatchesName } from '../utils/case-manager';
import { skipIfModuleNotVisible } from '../utils/module-guards';

test.describe('RX-PAD-E2E-0XX: My module prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add my module → end visit`, async ({ page }) => {
      test.setTimeout(360_000);
      const { myModule, advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.myModule);

      await modules.addMyModule(myModule.expectedName, myModule.searchTerm);

      const saveContext = await finishRegressionVisit(page, modules, {}, {
        // field key must match assertSaveAndPreview / case-manager
        myModule: myModule.expectedName,
      });

      expect(myModuleMatchesName(saveContext.myModuleField, myModule.expectedName)).toBe(true);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        previewAfterEdit: {
          myModule: myModule.expectedName,
          advice: [advice.editAdd],
        },
        repeatExpectations: {
          myModule: myModule.displayLabel,
          advice: [advice.editAdd],
        },
      });
    });
  }
});
```

## B — Drawer / form + PDF lines (vitals / advice)

```typescript
import { test, expect } from '@playwright/test';
import { ENTRY_PATHS } from '../fixtures/entry-paths';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import { entryPathTitle, setupRegressionSession } from '../helpers/regression.harness';
import {
  finishModuleVisitWithPdf,
  runEditAndRepeatRxValidation,
} from '../helpers/module-regression.harness';
import { skipIfModuleNotVisible } from '../utils/module-guards';
import { myModuleMatchesPayload } from '../utils/case-manager';

test.describe('RX-PAD-E2E-0XX: My module prescription', () => {
  for (const entryPath of ENTRY_PATHS) {
    test(`${entryPathTitle(entryPath)} → add my module → end visit`, async ({ page }) => {
      test.setTimeout(360_000);
      const { myModule, advice } = REGRESSION_TEST_DATA;

      const { modules } = await setupRegressionSession(page, entryPath);
      await skipIfModuleNotVisible(page, REGRESSION_TEST_DATA.modules.myModule);

      await modules.addMyModule(myModule);
      await modules.assertMyModuleOnPad(myModule);

      const saveContext = await finishModuleVisitWithPdf(page, modules, [
        myModule.displayLine1,
        myModule.displayLine2,
      ]);

      expect(myModuleMatchesPayload(saveContext, myModule)).toBe(true);

      await runEditAndRepeatRxValidation(page, modules, saveContext.tcmId, {
        editAdvice: advice.editAdd,
        pdfTextsAfterEdit: [myModule.displayLine1, advice.editAdd],
        repeatExpectations: {
          myModule,
          advice: [advice.editAdd],
        },
      });
    });
  }
});
```

## C — Walk-in only (mega / full consultation)

Skip `ENTRY_PATHS` loop; single `test()` with `setupRegressionSession(page, 'walk-in')`.
Use when flow is long or appointment path is redundant.

## Page object method stub

```typescript
async addMyModule(data: typeof REGRESSION_TEST_DATA.myModule) {
  await purgeUiBlockers(this.page);
  await this.appShell.dismissBlockingOverlays();

  const box = moduleBoxByTitle(
    this.page,
    REGRESSION_TEST_DATA.modules.myModule,
    /my module/i,
  );
  await scrollModuleIntoView(this.page, REGRESSION_TEST_DATA.modules.myModule);
  await box.scrollIntoViewIfNeeded();

  // … drawer / search / save …
}

async assertMyModuleOnPad(data: typeof REGRESSION_TEST_DATA.myModule) {
  const box = moduleBoxByTitle(this.page, REGRESSION_TEST_DATA.modules.myModule);
  await expect(box.getByText(data.displayLabel, { exact: false })).toBeVisible({
    timeout: 10_000,
  });
}
```

## package.json script

```json
"test:regression:my-module": "playwright test tests/regression/my-module.spec.ts"
```

## test-ids.ts entry

```typescript
'My Module Title': RX_TEST_IDS.MODULE_MY_MODULE,
```

Portal mirror in `Pm-Doctor-Portal/src/utils/e2eTestIds.js`:

```javascript
MODULE_MY_MODULE: 'rx-module-my-module',
```
