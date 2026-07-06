/**
 * Verify Midscene model env + API key (text + vision + locate).
 * Usage: npm run test:ai:check-model
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { runConnectivityTest } from '@midscene/core';
import { globalModelConfigManager } from '@midscene/shared/env';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

function mask(value) {
  if (!value?.trim()) return '(not set)';
  const v = value.trim();
  if (v.length <= 8) return '****';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

const required = [
  'MIDSCENE_MODEL_BASE_URL',
  'MIDSCENE_MODEL_API_KEY',
  'MIDSCENE_MODEL_NAME',
  'MIDSCENE_MODEL_FAMILY',
];

console.log('\nMidscene env (from ai-testing-poc/.env):\n');
for (const key of required) {
  const raw = process.env[key];
  const display =
    key === 'MIDSCENE_MODEL_API_KEY' ? mask(raw) : raw?.trim() || '(not set)';
  console.log(`  ${key}=${display}`);
}
console.log('');

const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`);
  console.error('See .env.example and https://midscenejs.com/model-common-config.html\n');
  process.exit(1);
}

let defaultModelConfig;
let planningModelConfig;
let insightModelConfig;

try {
  defaultModelConfig = globalModelConfigManager.getModelConfig('default');
  planningModelConfig = globalModelConfigManager.getModelConfig('planning');
  insightModelConfig = globalModelConfigManager.getModelConfig('insight');
} catch (error) {
  console.error('Model config error:', error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log('Calling model API (text + vision + locate)…\n');

const result = await runConnectivityTest({
  defaultModelConfig,
  planningModelConfig,
  insightModelConfig,
});

for (const check of result.checks) {
  const status = check.passed ? 'PASS' : 'FAIL';
  console.log(
    `  [${status}] ${check.name} (${check.modelName}, family=${check.modelFamily ?? 'n/a'}) ${check.durationMs}ms`,
  );
  if (!check.passed && check.message) {
    console.log(`         ${check.message}`);
  }
}

console.log('');
if (result.passed) {
  console.log('All checks passed — key and model config look good.\n');
  process.exit(0);
}

console.error('Connectivity check failed — fix API key, model name, or family.\n');
process.exit(1);
