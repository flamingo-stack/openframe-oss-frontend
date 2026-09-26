'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The one gate for the Agent Logs surface. The tab shows only when `'on'`; the menu
 * entry and Run Script CTA point at Overview's logs until then, and a deep link waits.
 */
export function useDeviceAgentLogsGate(): FeatureFlagGate {
  return useFeatureFlagGate('device-agent-logs');
}
