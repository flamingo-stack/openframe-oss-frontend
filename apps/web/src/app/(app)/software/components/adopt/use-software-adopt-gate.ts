'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * Whether Adopt exists (the `software-adopt` FE flag): the "installed manually" banner on a title's Devices tab, the
 * Adopt page, the ADOPTING / ADOPTION FAILED chips on its devices and the All Software Adoption column. Off, the
 * Software screens are what they were before Adopt, `/software/adopt` 404s, and no query asks for an adoption field, so
 * a backend without them (before oss-lib #3102) answers as before.
 *
 * The queries that read adoption fields take `gate === 'on'` as their `adopt` variable. The flag is answered with
 * `software-management`, by the same flags query, so a Software screen never runs its query while this one is loading.
 */
export function useSoftwareAdoptGate(): FeatureFlagGate {
  return useFeatureFlagGate('software-adopt');
}
