'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The one gate for the Tenant Management module: the hub card and every page under
 * `/settings/tenant-management`. Tri-state on purpose — `'loading'` renders a
 * skeleton, never a 404 or a missing card (see `use-feature-flag.ts`).
 */
export function useTenantManagementGate(): FeatureFlagGate {
  return useFeatureFlagGate('tenant-management');
}
