'use client';

import { useEffect } from 'react';
import { onAppResume } from '@/lib/native-shell';
import { refreshIfStale } from '@/lib/token-refresh-manager';

/**
 * Rotates the access token when a backgrounded tab comes back.
 *
 * A hidden tab issues no requests (the interval poll is gated on visibility,
 * `refetchOnWindowFocus` is off app-wide), so returning to it releases the whole
 * page's queries at once, all carrying a dead token. `refreshIfStale()` collapses
 * that burst into one rotation up front, and no-ops when the credential is still
 * fresh, when there is none, or when the native shell owns refreshing.
 */
export function TokenFreshnessWatcher() {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshIfStale();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Mobile shell: WKWebView does not reliably flip `visibilityState` when the
    // app is backgrounded, and the phone is where returning after hours is the
    // norm — so listen to the shell's own resume event as well. Concurrent
    // triggers are harmless: the refresh is single-flight.
    const removeAppListener = onAppResume(() => void refreshIfStale(), 'Token Freshness');

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      removeAppListener();
    };
  }, []);

  return null;
}
