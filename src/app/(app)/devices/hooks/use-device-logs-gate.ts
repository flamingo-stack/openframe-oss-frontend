'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/** The gate for the Device Logs tab and the "Device Logs" entry points that lead to it. */
export function useDeviceLogsGate(): FeatureFlagGate {
  return useFeatureFlagGate('device-agent-logs');
}
