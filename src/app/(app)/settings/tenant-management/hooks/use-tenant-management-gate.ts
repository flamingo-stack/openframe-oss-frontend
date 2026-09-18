'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The one gate for the Tenant Management module (CU-86akj8ajt): the hub card
 * and every page under `/settings/tenant-management`. Tri-state on purpose —
 * `'loading'` renders a skeleton, never a 404 or a missing card (see
 * `use-feature-flag.ts`). The backend does not register `tenant-management`
 * yet (unknown names answer `false`), so the dev server bypasses the server
 * answer, exactly like `useRemoteAccessApprovalGate` does for its mock-backed flow.
 */
export function useTenantManagementGate(): FeatureFlagGate {
  const serverGate = useFeatureFlagGate('tenant-management');
  return process.env.NODE_ENV === 'development' ? 'on' : serverGate;
}
