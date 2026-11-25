'use client';

import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * Whether the Checks list, a check's page and the check links from an incident's details exist.
 * saas-api serves the check settings only behind `openframe.insight.check-settings.enabled` and
 * refuses every read and write while it is off, so none of them may outlive that flag.
 *
 * On for now, while the backend flag is on wherever this build runs. Before that stops being true it
 * becomes the `insight-check-settings` FE flag, registered in saas-tenant's `openframe.fe-feature-flag`
 * beside the backend key: add the name to `FEATURE_FLAG_NAMES` and return
 * `useFeatureFlagGate('insight-check-settings')` here. Callers already handle all three states.
 */
export function useChecksGate(): FeatureFlagGate {
  return 'on';
}
