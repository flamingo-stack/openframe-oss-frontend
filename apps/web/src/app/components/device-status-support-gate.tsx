'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { resolveManagedStatusSupport } from '@/lib/device-status-probe';
import {
  isManagedStatusSupportKnown,
  readStoredManagedStatusSupport,
  setManagedStatusSupported,
} from '@/lib/device-status-support';

/** How long the page waits for the backend's answer before it goes on without MANAGED. */
const PROBE_TIMEOUT_MS = 3000;

function initiallyKnown(): boolean {
  if (isManagedStatusSupportKnown()) return true;
  const stored = typeof window === 'undefined' ? null : readStoredManagedStatusSupport();
  if (stored === null) return false;
  setManagedStatusSupported(stored);
  return true;
}

/**
 * Holds the page until the app knows whether the backend's device status enum has MANAGED
 * (`device-status-support.ts`), so the first device query a page builds already sends the right statuses. Asked
 * once per tab (a reload in the tab reuses the answer); the shell around the page renders meanwhile. Always mounted
 * and never swaps what it renders once ready, so nothing below remounts.
 */
export function DeviceStatusSupportGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(initiallyKnown);

  useEffect(() => {
    if (ready) return undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    const timer = setTimeout(() => {
      // No answer in time: go on without MANAGED (every backend accepts that); the probe may still store one.
      if (!isManagedStatusSupportKnown()) setManagedStatusSupported(false);
      finish();
    }, PROBE_TIMEOUT_MS);
    void resolveManagedStatusSupport().finally(() => {
      clearTimeout(timer);
      finish();
    });
    return () => clearTimeout(timer);
  }, [ready]);

  return ready ? <>{children}</> : null;
}
