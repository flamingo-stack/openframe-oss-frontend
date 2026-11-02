'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Sends a route that does not exist in this app mode to its counterpart: a SaaS
 * tenant's home is Mingo's, and an OSS tenant has no Mingo. App mode is known before
 * the first paint, so the page decides synchronously and draws nothing on its way
 * out. `null` = stay.
 *
 * `carryLocation` appends the live query and fragment (a `?mingoDialog=` from an old
 * link rides along to `MingoDialogParamBridge`); `target` must then be a bare path.
 */
export function useAppModeRedirect(target: string | null, { carryLocation = false } = {}): void {
  const router = useRouter();
  useEffect(() => {
    if (target === null) return;
    router.replace(carryLocation ? `${target}${window.location.search}${window.location.hash}` : target);
  }, [target, carryLocation, router]);
}
