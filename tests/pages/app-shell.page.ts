import { expect, type Page } from '@playwright/test';
import { AUTH_TOKEN_KEY } from '../auth.constants';
import {
  PREMIUM_POPUP_SELECTOR,
  purgeUiBlockers,
} from '../helpers/premium-popup-guard';
import { dismissKnownBlockers } from '../helpers/ui-blocker-guard';

/**
 * Shared shell helpers: auth checks and overlay dismissal.
 */
export class AppShellPage {
  constructor(private readonly page: Page) {}

  async assertAuthenticated() {
    await expect(this.page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(this.page).not.toHaveURL(
      /\/final-setup\?.*isAccountLocked=true/,
      { timeout: 5_000 },
    );

    const hasToken = await this.page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      try {
        const token = JSON.parse(raw) as string;
        return typeof token === 'string' && token.startsWith('eyJ');
      } catch {
        return false;
      }
    }, AUTH_TOKEN_KEY);

    expect(hasToken).toBe(true);
  }

  async assertMainShellVisible() {
    await expect(
      this.page.locator('header, .ant-layout, nav').first(),
    ).toBeVisible({ timeout: 15_000 });
  }

  private get premiumPopup() {
    return this.page.locator(PREMIUM_POPUP_SELECTOR);
  }

  /** MoEngage — "Explore premium features" / "Don't miss out on our premium features" */
  async dismissPremiumPopup() {
    if (!(await this.premiumPopup.first().isVisible({ timeout: 800 }).catch(() => false))) {
      return;
    }

    for (const popup of await this.premiumPopup.all()) {
      const closeSvg = popup.locator('svg[data-name="close-popup"]').first();
      if (await closeSvg.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeSvg.click({ force: true });
        continue;
      }

      const closeImg = popup.locator('img').first();
      if (await closeImg.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeImg.click({ force: true });
      }
    }

    await purgeUiBlockers(this.page);
    await expect(this.premiumPopup.first())
      .toBeHidden({ timeout: 3_000 })
      .catch(() => undefined);
  }

  /** Call before any click that keeps getting intercepted. */
  async dismissBlockingOverlays(context?: string) {
    await dismissKnownBlockers(this.page, context ?? 'app-shell');
  }

  async dismissPastTimeSlotPopover() {
    const popover = this.page.getByText(/past time slot/i);
    if (await popover.isVisible({ timeout: 500 }).catch(() => false)) {
      await this.page.keyboard.press('Escape');
    }
  }

  async dismissDashboardBlockers() {
    await this.dismissPremiumPopup();
    await dismissKnownBlockers(this.page, 'dashboard');
  }
}
