'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/** The gate for the Agent Logs tab and the "Device Logs" entry points that lead to it. */
export function useDeviceAgentLogsGate(): FeatureFlagGate {
  return useFeatureFlagGate('device-agent-logs');
}
