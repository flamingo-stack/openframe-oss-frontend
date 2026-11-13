'use client';

import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { useFeatureFlagsReady } from '@/app/hooks/use-feature-flag';
import { resolveManagedStatusSupport } from '@/lib/device-status-probe';
import {
  isManagedStatusSupportKnown,
  readStoredManagedStatusSupport,
  setManagedStatusSupported,
} from '@/lib/device-status-support';

/** How long the page waits for the backend's answer before it goes on without MANAGED. */
const PROBE_TIMEOUT_MS = 3000;

const listeners = new Set<() => void>();

/** One probe per tab, however often the gate mounts (Strict Mode mounts it twice). */
let probe: Promise<boolean> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce(): void {
  for (const listener of listeners) listener();
}

/** Known in this tab: answered already, or stored by an earlier load of the tab (then taken over at once). */
function isKnown(): boolean {
  if (isManagedStatusSupportKnown()) return true;
  const stored = readStoredManagedStatusSupport();
  if (stored === null) return false;
  setManagedStatusSupported(stored);
  return true;
}

/** The server cannot read the tab's storage: it renders the waiting state, and hydration starts from it too. */
function isKnownOnServer(): boolean {
  return false;
}

/**
 * Holds the page until the flags have answered (the device status look, `DeviceStatusDisplayFromFlag`, is one) and the
 * app knows whether the backend's device status enum has MANAGED
 * (`device-status-support.ts`), so the first device query a page builds already sends the right statuses. Asked
 * once per tab (a reload in the tab reuses the answer); the shell around the page renders meanwhile. Always mounted
 * and never swaps what it renders once ready, so nothing below remounts.
 *
 * The answer is read through `useSyncExternalStore` with a server snapshot of "not known": the tab's stored answer
 * exists only in the browser, and reading it in the first client render would not match the server's HTML.
 */
export function DeviceStatusSupportGate({ children }: { children: ReactNode }) {
  const known = useSyncExternalStore(subscribe, isKnown, isKnownOnServer);
  // Settles on its own: `FeatureFlagsLoader` marks the flags loaded on a failed query too.
  const flagsReady = useFeatureFlagsReady();
  const ready = known && flagsReady;

  useEffect(() => {
    if (isKnown()) return undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      announce();
    };
    const timer = setTimeout(() => {
      // No answer in time: go on without MANAGED (every backend accepts that); the probe may still store one.
      if (!isManagedStatusSupportKnown()) setManagedStatusSupported(false);
      finish();
    }, PROBE_TIMEOUT_MS);
    probe ??= resolveManagedStatusSupport();
    void probe.finally(() => {
      clearTimeout(timer);
      finish();
    });
    return () => clearTimeout(timer);
  }, []);

  return ready ? <>{children}</> : null;
}
