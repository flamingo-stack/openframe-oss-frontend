'use client';

import { FAIL_OPEN_AFTER_MS, useFailOpen } from '@/app/hooks/use-fail-open';
import { useAuthSession } from './use-auth-session';

/**
 * Whether the session check has gone unanswered past the fail-open window: no `/me` answer yet (a gateway that keeps
 * failing it, or answers it without a session, which the check retries as transient) for `FAIL_OPEN_AFTER_MS`.
 * The flags, the chat and every gate behind the session wait on that answer, and the page sat on its skeletons with
 * nothing in the console (CU-17tkuw69v8q). Never while the check is paused offline: an app shell's cold start without
 * network renders from the stored session instead. Goes back to `false` the moment `/me` answers, either way.
 */
export function useSessionNeverResolved(): boolean {
  const { isReady, isPaused } = useAuthSession();
  const unanswered = !isReady && !isPaused;
  const waiting = useFailOpen(unanswered, FAIL_OPEN_AFTER_MS, 'session (/api/me)');
  return unanswered && !waiting;
}
