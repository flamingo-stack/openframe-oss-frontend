'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import type { NeedsYouDismissed, NeedsYouRow } from './needs-you-rows';

const DISMISSED_KEY_PREFIX = 'openframe:needs-you-dismissed:';

/** How many dismissals are kept: the newest, so the stored list stays small. */
export const NEEDS_YOU_DISMISSED_LIMIT = 200;

const NONE: NeedsYouDismissed = {};

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The last read per key, so the snapshot keeps its identity while the stored text does not change.
let cache: { key: string; raw: string | null; value: NeedsYouDismissed } | null = null;

/** The stored dismissals: `{ [row key]: epoch ms }`. Anything else reads as none. */
function readDismissed(key: string): NeedsYouDismissed {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return NONE;
  }
  if (cache && cache.key === key && cache.raw === raw) return cache.value;
  let value: NeedsYouDismissed = NONE;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      value = Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
      );
    }
  } catch {
    value = NONE;
  }
  cache = { key, raw, value };
  return value;
}

const serverDismissed = () => NONE;

/**
 * The "Needs you" rows this user dismissed on this device, and how to dismiss one. A row the
 * user acted on (asked Mingo about, or opened) leaves the queue and the next one moves up; it
 * comes back only if it starts needing them again later (`isDismissed`). Kept per user, the
 * newest `NEEDS_YOU_DISMISSED_LIMIT`.
 *
 * An external-store read, so the server's markup (none) and the first client render agree, and
 * every card on the page (the shell's held one, the page's) reads the same list.
 */
export function useNeedsYouDismissed(): [NeedsYouDismissed, (row: NeedsYouRow) => void] {
  const userId = useAuthStore(state => state.user?.id);
  const key = `${DISMISSED_KEY_PREFIX}${userId ?? 'anonymous'}`;
  const dismissed = useSyncExternalStore(subscribe, () => readDismissed(key), serverDismissed);
  const dismiss = useCallback(
    (row: NeedsYouRow) => {
      const next = Object.entries({ ...readDismissed(key), [row.key]: Date.now() })
        .sort((a, b) => b[1] - a[1])
        .slice(0, NEEDS_YOU_DISMISSED_LIMIT);
      try {
        window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(next)));
      } catch {
        // Blocked storage: the row stays in the queue.
        return;
      }
      for (const listener of listeners) listener();
    },
    [key],
  );
  return [dismissed, dismiss];
}
