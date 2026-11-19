'use client';

import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * Whether Adopt exists: the "installed manually" banner on a title's Devices tab, the Adopt page, and the ADOPTING /
 * ADOPTION FAILED chips on its devices. Off, the Devices tab is what it was before Adopt and `/software/adopt` 404s.
 *
 * On for now, without asking the server, so the whole flow can be tested on the feature tenant (tenant-4599-86) while
 * the backend (oss-lib #3102) is not released. Before this pull request merges it becomes the `software-adopt` FE flag,
 * registered in saas-tenant's `openframe.fe-feature-flag`: add the name to `FEATURE_FLAG_NAMES` and return
 * `useFeatureFlagGate('software-adopt')` here. Every caller already handles all three states.
 */
export function useSoftwareAdoptGate(): FeatureFlagGate {
  return 'on';
}
