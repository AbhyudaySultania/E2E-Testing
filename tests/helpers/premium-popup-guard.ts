import type { Page } from '@playwright/test';

const GUARD_FLAG = '__overlayGuardsInstalled';
const ROUTE_FLAG = '__moengageRoutesBlocked';

export const PREMIUM_POPUP_SELECTOR =
  '[id^="moe-onsite-campaign"], [role="dialog"][aria-label*="pop-up" i], .moe-onsite-campaign, [class*="moe-onsite"]';

/** Runs in the browser — observer + CSS hide so MoEngage cannot re-cover the UI. */
export const PREMIUM_BLOCKER_INIT_SCRIPT = () => {
  const selector =
    '[id^="moe-onsite-campaign"], [role="dialog"][aria-label*="pop-up" i], .brz-bg, .moe-onsite-campaign, [class*="moe-onsite"]';

  const removeNodes = () => {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  };

  removeNodes();

  if (!document.getElementById('pw-hide-moengage')) {
    const style = document.createElement('style');
    style.id = 'pw-hide-moengage';
    style.textContent = `${selector} { display: none !important; visibility: hidden !important; pointer-events: none !important; }`;
    document.head.appendChild(style);
  }

  const w = window as Window & { __pwMoengageObserver?: MutationObserver };
  if (!w.__pwMoengageObserver) {
    w.__pwMoengageObserver = new MutationObserver(removeNodes);
    w.__pwMoengageObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
};

async function removePremiumPopups(page: Page) {
  await page.evaluate((selector) => {
    document.querySelectorAll(selector).forEach((node) => node.remove());
    document.querySelectorAll('.brz-bg').forEach((node) => node.remove());
  }, PREMIUM_POPUP_SELECTOR);
}

async function removeTalkativeWidget(page: Page) {
  await page.evaluate(() => {
    const talkative = document.getElementById('talkative-engage');
    if (talkative) {
      talkative.remove();
    }
    document
      .querySelectorAll('[id*="talkative"], iframe[title*="chat" i]')
      .forEach((node) => node.remove());
  });
}

async function dismissPremiumPopupDom(page: Page) {
  const premiumPopup = page.locator(PREMIUM_POPUP_SELECTOR);

  for (const popup of await premiumPopup.all()) {
    const closed = await popup.evaluate((el) => {
      const closeSvg = el.querySelector('svg[data-name="close-popup"]') as HTMLElement | null;
      if (closeSvg) {
        closeSvg.click();
        return true;
      }

      const imgs = el.querySelectorAll('img');
      const closeImg = imgs[imgs.length - 1] as HTMLElement | undefined;
      if (closeImg) {
        closeImg.click();
        return true;
      }

      el.remove();
      return true;
    });

    if (!closed) {
      await popup.evaluate((el) => el.remove());
    }
  }

  await removePremiumPopups(page);
}

async function blockMoEngageCampaignRoutes(page: Page) {
  const taggedPage = page as Page & { [ROUTE_FLAG]?: boolean };
  if (taggedPage[ROUTE_FLAG]) return;
  taggedPage[ROUTE_FLAG] = true;

  await page.route(/moengage\.com/i, async (route) => {
    const url = route.request().url();
    if (/onsite|campaign|inapp|webpersonalization/i.test(url)) {
      await route.abort();
      return;
    }
    await route.continue();
  });
}

/**
 * Auto-dismiss MoEngage premium banners and Talkative chat whenever they block actions.
 */
export async function installPremiumPopupGuard(page: Page): Promise<void> {
  const taggedPage = page as Page & { [GUARD_FLAG]?: boolean };

  await page.addInitScript(PREMIUM_BLOCKER_INIT_SCRIPT);
  await page.evaluate(PREMIUM_BLOCKER_INIT_SCRIPT);
  await blockMoEngageCampaignRoutes(page);

  if (taggedPage[GUARD_FLAG]) return;
  taggedPage[GUARD_FLAG] = true;

  const premiumPopup = page.locator(PREMIUM_POPUP_SELECTOR);

  await page.addLocatorHandler(premiumPopup, async (popup) => {
    const closeSvg = popup.locator('svg[data-name="close-popup"]').first();
    if (await closeSvg.isVisible({ timeout: 300 }).catch(() => false)) {
      await closeSvg.click({ force: true });
      await removePremiumPopups(page);
      return;
    }

    const closeImg = popup.locator('img').last();
    if (await closeImg.isVisible({ timeout: 300 }).catch(() => false)) {
      await closeImg.click({ force: true });
      await removePremiumPopups(page);
      return;
    }

    await removePremiumPopups(page);
  });

  const talkative = page.locator('#talkative-engage');

  await page.addLocatorHandler(talkative, async () => {
    await removeTalkativeWidget(page);
  });
}

export async function purgeUiBlockers(page: Page) {
  await page.evaluate(PREMIUM_BLOCKER_INIT_SCRIPT);
  await dismissPremiumPopupDom(page);
  await removeTalkativeWidget(page);
}
