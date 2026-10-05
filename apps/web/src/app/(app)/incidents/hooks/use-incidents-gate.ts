'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isSaasTenantMode } from '@/lib/app-mode';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * Whether the Incidents module exists here: the insights API is saas-api only, so
 * any other app mode is a definitive 'off' whatever the `insights` flag says.
 */
export function useIncidentsGate(): FeatureFlagGate {
  const gate = useFeatureFlagGate('insights');
  return isSaasTenantMode() ? gate : 'off';
}
