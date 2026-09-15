'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The one gate for the approval-aware connect flow (CU-86ajx03db). 'off' means
 * the legacy behavior - the tunnel auto-starts with no consent step. The
 * backend does not register 'remote-access-approval' yet (unknown names come
 * back disabled), so the dev server bypasses the server answer - the flow must
 * be testable against the mock service before the approval API exists.
 */
export function useRemoteAccessApprovalGate(): FeatureFlagGate {
  const serverGate = useFeatureFlagGate('remote-access-approval');
  return process.env.NODE_ENV === 'development' ? 'on' : serverGate;
}
