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

/**
 * Tenant Management Phase 2: `'on'` only while both `tenant-management` and
 * `tenant-management-v2` are. The backend serves the phase-2 schema under the
 * same key, so `'off'` means main's screens and operations (the `v1/` copies),
 * and `'loading'` draws those in their loading scope: stage and prod run off.
 * Both flags come from one answer, so they never resolve apart.
 */
export function useTenantManagementV2Gate(): FeatureFlagGate {
  const phase1 = useFeatureFlagGate('tenant-management');
  const phase2 = useFeatureFlagGate('tenant-management-v2');
  if (phase1 === 'loading' || phase2 === 'loading') return 'loading';
  return phase1 === 'on' && phase2 === 'on' ? 'on' : 'off';
}
