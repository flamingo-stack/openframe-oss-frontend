'use client';

import { useMemo } from 'react';
import type { NavigationFlags } from '@/lib/navigation-config';
import { useFeatureFlag } from './use-feature-flag';

/**
 * The flags the sidebars gate their modules on, read reactively: each reads `false` until the flags answer, so a
 * gated entry appears when they do. One object per answer, because the navigation items are memoized on it.
 */
export function useNavigationFlags(): NavigationFlags {
  const insights = useFeatureFlag('insights');
  const insightCheckSettings = useFeatureFlag('insight-check-settings');
  const softwareManagement = useFeatureFlag('software-management');
  const tenantManagement = useFeatureFlag('tenant-management');
  const tenantManagementV2 = useFeatureFlag('tenant-management-v2');
  return useMemo(
    () => ({ insights, insightCheckSettings, softwareManagement, tenantManagement, tenantManagementV2 }),
    [insights, insightCheckSettings, softwareManagement, tenantManagement, tenantManagementV2],
  );
}
