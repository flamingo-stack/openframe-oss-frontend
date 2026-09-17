'use client';

import { useFeatureFlag } from '@/app/hooks/use-feature-flag';

/**
 * Whether the mock-service QA controls (simulate the end user's decision,
 * local .mcrec loader) render. TEMPORARY until the BE approval API
 * (CU-86ajx02gz) and recordings storage (CU-86akc3c5q) replace the mocks.
 *
 * Server flag `remote-access-mock-tools` (on for dev / qa) for deployed
 * builds; the dev server shows them regardless, mirroring the approval gate's
 * dev bypass - a local server pointed at an environment without the flag
 * (e.g. stage) still has nothing but the mock to test against.
 */
export function useRemoteAccessMockTools(): boolean {
  const flag = useFeatureFlag('remote-access-mock-tools');
  return process.env.NODE_ENV === 'development' || flag;
}
