'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The one gate for the Cloud Tenant Management module: every page under
 * `/cloud-tenant-management`. Tri-state on purpose — `'loading'` renders a
 * skeleton, never a 404 (see `use-feature-flag.ts`). The sidebar's "Integrations"
 * item reads the same flag through `NavigationFlags` in `app-layout.tsx`.
 */
export function useTenantManagementGate(): FeatureFlagGate {
  return useFeatureFlagGate('tenant-management');
}
