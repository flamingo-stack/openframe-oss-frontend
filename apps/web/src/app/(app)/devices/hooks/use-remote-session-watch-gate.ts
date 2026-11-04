'use client';

import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useIsMobileShell } from '@/app/hooks/use-is-mobile-shell';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import type { LiveRows } from '../components/remote-sessions/session-status';
import { useSessionRecordingsGate } from './use-session-recordings-gate';

/**
 * The gate for watching a running session live (the LIVE row, the live session
 * page, viewers in the Remote Control header): the `remote-session-watch` flag
 * on top of the session recordings surfaces, whose Remote Sessions lists carry
 * the LIVE row.
 */
export function useRemoteSessionWatchGate(): FeatureFlagGate {
  const recordings = useSessionRecordingsGate();
  const watch = useFeatureFlagGate('remote-session-watch');
  if (recordings === 'off' || watch === 'off') return 'off';
  if (recordings === 'loading' || watch === 'loading') return 'loading';
  return 'on';
}

/**
 * What the Remote Sessions lists need to draw LIVE rows; null until the gate is
 * on, so a running session reads by its recording as before.
 */
export function useLiveRows(): LiveRows | null {
  const gate = useRemoteSessionWatchGate();
  const userId = useAuthStore(s => s.user?.id ?? null);
  const isMobileShell = useIsMobileShell();
  return gate === 'on' ? { userId, remoteControl: !isMobileShell } : null;
}
