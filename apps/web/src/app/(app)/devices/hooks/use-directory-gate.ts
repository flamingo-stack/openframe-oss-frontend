'use client';

import { useTenantManagementGate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { runtimeEnv } from '@/lib/runtime-config';

/** The tenant's directories on the device screens: SaaS only, behind `tenant-management` (contract §7). */
export function useDirectoryGate(): FeatureFlagGate {
  const gate = useTenantManagementGate();
  return runtimeEnv.appMode() === 'saas-tenant' ? gate : 'off';
}
