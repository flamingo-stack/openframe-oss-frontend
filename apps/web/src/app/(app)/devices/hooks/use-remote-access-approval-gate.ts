'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The one gate for the approval-aware connect flow and the policy UI. 'off'
 * means the legacy behavior - the tunnel auto-starts with no consent step.
 * It follows the server flag on every build, the dev server included: the
 * flow talks to the approval API, which is switched on exactly where the flag is.
 */
export function useRemoteAccessApprovalGate(): FeatureFlagGate {
  return useFeatureFlagGate('remote-access-approval');
}
