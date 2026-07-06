import { ai } from '@zerostep/playwright';
import type { Page } from '@playwright/test';
import { test as playwrightTest } from '@playwright/test';

export type AiContext = { page: Page; test: typeof playwrightTest };

function shouldUsePlaywrightFallback(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('not iterable') ||
    message.includes('getContentQuads') ||
    message.includes('clickCDPElement') ||
    message.includes('zerostep.error') ||
    message.includes('No valid target found') ||
    message.includes('intercepts pointer events') ||
    message.includes('elementHandle.hover')
  );
}

export async function safeAiAction(
  prompt: string,
  ctx: AiContext,
  fallback?: () => Promise<void>,
): Promise<void> {
  try {
    await ai(prompt, ctx);
  } catch (err) {
    if (fallback && shouldUsePlaywrightFallback(err)) {
      await fallback();
      return;
    }
    throw err;
  }
}

export async function safeAiQuery(
  prompt: string,
  ctx: AiContext,
  fallback: () => Promise<string>,
): Promise<string> {
  try {
    return String(await ai(prompt, ctx)).trim();
  } catch (err) {
    if (shouldUsePlaywrightFallback(err)) {
      return fallback();
    }
    throw err;
  }
}
