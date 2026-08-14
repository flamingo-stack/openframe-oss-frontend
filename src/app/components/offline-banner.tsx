'use client';

import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribeConnectivity } from '@/lib/connectivity';

/**
 * Non-intrusive connectivity banner: a small pill while the network is down,
 * gone once it returns. Reachability is only ever a hint — it means "no network
 * interface", not "the gateway answers" — so this is not a substitute for the
 * per-request 401/refresh/retry paths. Web and native shell alike.
 *
 * Reads `connectivity.ts` rather than `navigator.onLine` directly. On device that
 * is the difference between a pill that clears promptly and one that sits on top
 * of live, already-recovered data — WKWebView's `online` event trails the real
 * reconnect badly (measurements in `connectivity.ts`).
 */
export function OfflineBanner() {
  // Start online: `navigator` is undefined during SSR/static export, and a
  // false-positive "offline" flash on first paint is worse than a one-tick
  // delay before the first real reading arrives.
  const [offline, setOffline] = useState(false);

  useEffect(() => subscribeConnectivity(online => setOffline(!online)), []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-[calc(var(--native-safe-top,0px)+0.5rem)] z-[70] -translate-x-1/2"
    >
      <div className="flex items-center gap-2 rounded-full bg-ods-card px-4 py-2 shadow-lg border border-ods-border">
        <WifiOff className="h-4 w-4 text-ods-text-secondary" />
        <span className="text-code text-ods-text-primary">You're offline</span>
      </div>
    </div>
  );
}
