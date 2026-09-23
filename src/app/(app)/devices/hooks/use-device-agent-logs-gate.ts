'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The backend does not register `device-agent-logs` yet, and a name it does not
 * know is absent from its answer. On the dev server that absence reads as "on";
 * an explicit `false` from any backend still turns the surface off.
 */
const DEV_FALLBACK = process.env.NODE_ENV === 'development';

/**
 * The one gate for the Agent Logs surface: tab, menu entry and Run Script
 * pointer. Tri-state, and every call site hides `'loading'` like `'off'`: a
 * `?tab=agent-logs` deep link re-resolves once the answer lands, because the
 * active tab is derived from the URL rather than latched.
 */
export function useDeviceAgentLogsGate(): FeatureFlagGate {
  return useFeatureFlagGate('device-agent-logs', DEV_FALLBACK);
}
