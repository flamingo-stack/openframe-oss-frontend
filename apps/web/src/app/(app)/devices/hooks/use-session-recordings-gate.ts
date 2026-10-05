'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { useRemoteAccessApprovalGate } from './use-remote-access-approval-gate';

/**
 * The gate for the session recordings surfaces (the device's Remote Sessions
 * tab and the recording page): the `session-recordings` flag on top of the
 * remote access feature itself, so recordings can stay off where remote
 * access is already on.
 */
export function useSessionRecordingsGate(): FeatureFlagGate {
  const remoteAccess = useRemoteAccessApprovalGate();
  const recordings = useFeatureFlagGate('session-recordings');
  if (remoteAccess === 'off' || recordings === 'off') return 'off';
  if (remoteAccess === 'loading' || recordings === 'loading') return 'loading';
  return 'on';
}
