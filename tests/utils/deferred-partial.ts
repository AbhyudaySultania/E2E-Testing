import { test } from '@playwright/test';
import {
  deferredPartialReason,
  type DeferredPartialCheckId,
} from '../fixtures/deferred-partial';

/** Skip remaining assertions for a partially verified flow (recorded as skipped, not failed). */
export function skipDeferredPartial(id: DeferredPartialCheckId): void {
  test.skip(true, deferredPartialReason(id));
}
