'use client';

import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { usePageFallback } from '@/app/components/page-fallback-context';
import { FAIL_OPEN_AFTER_MS, useFailOpen } from '@/app/hooks/use-fail-open';
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
 * Holds the page until the flags have answered, or `FAIL_OPEN_AFTER_MS` has passed (the device status look,
 * `DeviceStatusDisplayFromFlag`, is one), and the app knows whether the backend's device status enum has MANAGED
 * (`device-status-support.ts`), so the first device query a page builds already sends the right statuses. Asked
 * once per tab (a reload in the tab reuses the answer); the shell around the page renders meanwhile. Always mounted
 * and never swaps what it renders once ready, so nothing below remounts.
 *
 * The answer is read through `useSyncExternalStore` with a server snapshot of "not known": the tab's stored answer
 * exists only in the browser, and reading it in the first client render would not match the server's HTML.
 */
export function DeviceStatusSupportGate({ children }: { children: ReactNode }) {
  const known = useSyncExternalStore(subscribe, isKnown, isKnownOnServer);
  // `FeatureFlagsLoader` marks the flags loaded on a failed query too, but it asks only once the session has resolved
  // with a user: a session that never resolves never asks, and the page sat on its skeleton for good
  // (CU-17tkuw69v8q). Bounded like the chrome's own wait; the shell shows the session screen by then anyway.
  const flagsWaiting = useFailOpen(!useFeatureFlagsReady(), FAIL_OPEN_AFTER_MS, 'feature flags (device status gate)');
  const ready = known && !flagsWaiting;
  const fallback = usePageFallback();

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

  // While it waits, the shell's stand-in for the page (a landing route's skeleton, else nothing): on a landing page
  // the gate can still wait when the shell lets the page go (a new tab's probe), and drawing nothing emptied the
  // centre for that long (CU-17tkuw69uzq).
  return ready ? <>{children}</> : <>{fallback}</>;
}
