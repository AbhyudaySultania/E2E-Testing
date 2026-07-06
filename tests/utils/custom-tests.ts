/** Opt-in doctor-specific tests (custom modules, account setup). */

export function isCustomDietEnabled(): boolean {
  return process.env.RX_PAD_CUSTOM_DIET === '1';
}
