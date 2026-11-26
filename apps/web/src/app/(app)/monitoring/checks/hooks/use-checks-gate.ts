'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * Whether the Checks list, a check's page and the check links from an incident's details exist: the
 * `insight-check-settings` FE flag. saas-api serves the check settings only behind
 * `openframe.insight.check-settings.enabled` and refuses every read and write while it is off, so the FE flag is
 * registered where that one is on. A gate, not a boolean: callers render the loading branch until the flag answers.
 */
export function useChecksGate(): FeatureFlagGate {
  return useFeatureFlagGate('insight-check-settings');
}
