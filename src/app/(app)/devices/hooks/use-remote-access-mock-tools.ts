'use client';

import { useFeatureFlag } from '@/app/hooks/use-feature-flag';

/**
 * Whether the recording player's local .mcrec loader renders. TEMPORARY until
 * the recordings storage replaces the recordings mock.
 *
 * Server flag `remote-access-mock-tools` (on for dev / qa) for deployed
 * builds; the dev server shows it regardless, mirroring the approval gate's
 * dev bypass - a local server pointed at an environment without the flag
 * (e.g. stage) still has nothing but the mock to test against.
 */
export function useRemoteAccessMockTools(): boolean {
  const flag = useFeatureFlag('remote-access-mock-tools');
  return process.env.NODE_ENV === 'development' || flag;
}
