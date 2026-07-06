/**
 * Heal loop V2 type definitions (reference only — orchestration stays in .mjs).
 */

export type HealClassificationLabel = 'ui-change' | 'bug' | 'env' | 'flaky';

export type HealConfidenceTier = 'high' | 'medium' | 'low';

export type HealRecommendedAction =
  | 'heal-test'
  | 'fix-portal'
  | 'fix-env'
  | 'investigate';

export interface HealFailureRecord {
  specFile: string;
  title: string;
  project?: string;
  status: string;
  error: string;
  stack?: string;
  durationMs?: number;
}

export interface HealClassification {
  label: HealClassificationLabel;
  /** 0–100 numeric score for V2 gates */
  confidence: number;
  confidenceTier: HealConfidenceTier;
  recommendedAction: HealRecommendedAction;
  evidence: string[];
  note?: string;
}

export interface HealSessionV2 {
  version: 2;
  session_id: string;
  failed_spec: string;
  failed_test_title: string;
  classification: HealClassificationLabel;
  confidence: number;
  confidence_tier: HealConfidenceTier;
  recommended_action: HealRecommendedAction;
  trace_path: string | null;
  screenshot_paths: string[];
  last_green_path: string;
  last_green: Record<string, unknown> | null;
  portal_commits_since_last_green: string[];
  timestamp: string;
  regression_failure_count: number;
  proposed_patch_path: string;
  session_dir: string;
  allowed_edit_roots: string[];
  hard_rules: string[];
  failure_error?: string;
}

export interface HealApplyResult {
  applied: boolean;
  verifyPassed: boolean;
  groundTruthPassed: boolean;
  failuresBefore: number;
  failuresAfter: number;
  rolledBack: boolean;
}
