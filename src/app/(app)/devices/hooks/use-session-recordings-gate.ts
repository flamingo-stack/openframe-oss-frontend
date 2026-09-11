'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';

/**
 * The one gate for every session-recordings surface (the Remote Sessions tab
 * and the recording detail page). The backend does not register
 * 'session-recordings' yet (unknown names come back disabled), so the dev
 * server bypasses the server answer - the feature must be testable against
 * local sample files before the storage backend (CU-86akc3c5q) exists.
 */
export function useSessionRecordingsGate(): FeatureFlagGate {
  const serverGate = useFeatureFlagGate('session-recordings');
  return process.env.NODE_ENV === 'development' ? 'on' : serverGate;
}
