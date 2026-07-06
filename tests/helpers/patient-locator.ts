import type { Locator, Page } from '@playwright/test';

/** Search dropdown option — name + mobile when multiple patients share a number. */
export function patientSearchOption(
  dropdown: Locator,
  patientName: string,
  mobile: string,
): Locator {
  return dropdown
    .locator('.list-patientName, .ant-select-item-option, li, [class*="option"]')
    .filter({ hasText: mobile })
    .filter({ hasText: patientName })
    .first();
}

/** Queue / table row — name + mobile (prefer .last() for the newest slot on that day). */
export function patientQueueRow(
  root: Page | Locator,
  patientName: string,
  mobile: string,
): Locator {
  return root
    .locator('tr, .appointment-row, .ant-table-row')
    .filter({ hasText: mobile })
    .filter({ hasText: patientName })
    .last();
}
