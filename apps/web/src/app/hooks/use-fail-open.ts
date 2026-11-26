'use client';

import { useEffect, useState } from 'react';

/**
 * How long a loading state that only waits for an answer may wait before it gives up and draws what it has. Sized
 * like the session latch's own fail-open in `lib/session-ready.ts`: longer than any healthy pair of round trips,
 * shorter than a user's patience.
 */
export const FAIL_OPEN_AFTER_MS = 10_000;

/**
 * `loading`, but never forever.
 *
 * A loading state that is a latch over async answers, with no way out, is one missing terminal outcome away from a
 * permanent skeleton — which is what shipped more than once: a store reset after hydration left the sidebar and
 * header loading for the rest of the session (the chrome), and a session that never resolved after a sign-in left
 * the page behind the device status gate on its skeleton (CU-17tkuw69v8q). `lib/session-ready.ts` spells out the
 * rule for the request gate ("THIS GATE IS AN OPTIMIZATION AND MUST FAIL OPEN"); a gate that only waits for an
 * answer is the same kind of optimization and earns the same predicate.
 *
 * Failing open degrades rather than breaks: the waiter draws from whatever it currently reads, and it recovers on its
 * own the moment a real answer lands. `label`, when given, names the wait in one console warning when it gives up, so
 * a report from the field says which answer never came.
 */
export function useFailOpen(loading: boolean, afterMs: number, label?: string): boolean {
  const [failedOpen, setFailedOpen] = useState(false);

  // Re-arm during render: a later load gets its own full window rather than
  // inheriting a previous timeout's verdict, and doing it here means the waiter
  // is never drawn once in the failed-open state after a fresh load begins.
  const [wasLoading, setWasLoading] = useState(loading);
  if (loading !== wasLoading) {
    setWasLoading(loading);
    if (!loading) setFailedOpen(false);
  }

  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => {
      if (label) console.warn(`[fail-open] ${label}: no answer after ${afterMs} ms, going on without it`);
      setFailedOpen(true);
    }, afterMs);
    return () => clearTimeout(timer);
  }, [loading, afterMs, label]);

  return loading && !failedOpen;
}
