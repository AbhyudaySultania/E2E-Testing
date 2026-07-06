const MIDSCENE_SKIP_REASON =
  'Midscene model not configured. Add to .env:\n' +
  '  MIDSCENE_MODEL_BASE_URL=https://api.openai.com/v1\n' +
  '  MIDSCENE_MODEL_API_KEY=sk-...\n' +
  '  MIDSCENE_MODEL_NAME=gpt-5.4\n' +
  '  MIDSCENE_MODEL_FAMILY=gpt-5\n' +
  'See https://midscenejs.com/model-strategy';

export function isMidsceneConfigured(): boolean {
  return requiredMidsceneEnv().every((key) => !!process.env[key]?.trim());
}

export function midsceneEnvStatus(): { key: string; set: boolean }[] {
  return requiredMidsceneEnv().map((key) => ({
    key,
    set: !!process.env[key]?.trim(),
  }));
}

function requiredMidsceneEnv(): string[] {
  return [
    'MIDSCENE_MODEL_API_KEY',
    'MIDSCENE_MODEL_BASE_URL',
    'MIDSCENE_MODEL_NAME',
    'MIDSCENE_MODEL_FAMILY',
  ];
}

export function midsceneSkipReason(): string {
  const missing = requiredMidsceneEnv().filter((k) => !process.env[k]?.trim());
  if (missing.length === 0) return MIDSCENE_SKIP_REASON;
  return `Missing in .env: ${missing.join(', ')}. ${MIDSCENE_SKIP_REASON}`;
}

export function assertMidsceneConfigured(): void {
  if (!isMidsceneConfigured()) {
    throw new Error(MIDSCENE_SKIP_REASON);
  }
}
