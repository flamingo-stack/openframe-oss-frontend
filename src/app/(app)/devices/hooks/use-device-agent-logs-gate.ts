'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The one gate for the Agent Logs surface: tab, menu entry and Run Script
 * pointer. Tri-state — `'loading'` hides like `'off'`. The dev server bypasses
 * the server answer, which is `false` for a name the backend has not registered.
 */
export function useDeviceAgentLogsGate(): FeatureFlagGate {
  const serverGate = useFeatureFlagGate('device-agent-logs');
  return process.env.NODE_ENV === 'development' ? 'on' : serverGate;
}
