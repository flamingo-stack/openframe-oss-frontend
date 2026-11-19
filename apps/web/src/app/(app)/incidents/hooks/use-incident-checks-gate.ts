'use client';

import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * Whether the Incident Checks tab exists, and with it the links from an incident's thresholds to it.
 * saas-api serves the check settings only behind `openframe.insight.check-settings.enabled` and
 * refuses every read and write while it is off, so the tab must not outlive that flag.
 *
 * On for now, while the backend flag is on wherever this build runs. Before that stops being true it
 * becomes the `insight-check-settings` FE flag, registered in saas-tenant's `openframe.fe-feature-flag`
 * beside the backend key: add the name to `FEATURE_FLAG_NAMES` and return
 * `useFeatureFlagGate('insight-check-settings')` here. Callers already handle all three states.
 */
export function useIncidentChecksGate(): FeatureFlagGate {
  return 'on';
}
