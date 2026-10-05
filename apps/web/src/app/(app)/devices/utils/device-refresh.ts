'use client';

import { useDeferredValue, useSyncExternalStore } from 'react';

/**
 * A counter every device Relay query passes as its `fetchKey`, bumped when a
 * device mutation lands.
 *
 * This exists because there is no way to refetch a *mounted* Relay query from
 * outside it. `store.invalidateStore()` looks like the answer and is not:
 * `QueryResource.prepareWithIdentifier` returns its retained cache entry before
 * it ever calls `environment.check()`, so the staleness flag is never consulted
 * for a query that is already on screen — the archived device would sit in the
 * list until the panel remounted. `fetchKey` works because it feeds Relay's
 * `cacheBreaker`, changing the cache identifier and forcing a fresh fetch.
 *
 * A module-level counter rather than React state: the bump happens in
 * `invalidateDeviceQueries`, which is called from a mutation callback that has
 * no path to the components reading it.
 */
let deviceEpoch = 0;
const listeners = new Set<() => void>();

/** Bump every mounted device query to refetch. Called by `invalidateDeviceQueries`. */
export function bumpDeviceEpoch(): void {
  deviceEpoch += 1;
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot(): number {
  return deviceEpoch;
}

/**
 * The current epoch, for a device query's `fetchKey`.
 *
 * DEFERRED, because a new `fetchKey` is a new cache identifier and therefore a
 * fresh suspend: read live, archiving one device would drop the whole Devices
 * page to its skeleton. Deferred, the refetch is a transition — React keeps the
 * committed rows on screen until the new ones arrive, which is the background
 * refresh the react-query invalidation used to give.
 *
 * Server snapshot is the same counter — it only ever advances from a mutation,
 * which cannot have happened during a server render.
 */
export function useDeviceEpoch(): number {
  return useDeferredValue(useSyncExternalStore(subscribe, getSnapshot, getSnapshot));
}
