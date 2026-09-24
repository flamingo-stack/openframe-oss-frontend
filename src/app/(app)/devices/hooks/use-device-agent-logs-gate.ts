'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The one gate for the Agent Logs surface: tab, menu entry and Run Script
 * pointer. Tri-state, and every call site hides `'loading'` like `'off'`; a
 * `?tab=agent-logs` deep link re-resolves once the answer lands.
 */
export function useDeviceAgentLogsGate(): FeatureFlagGate {
  return useFeatureFlagGate('device-agent-logs');
}
