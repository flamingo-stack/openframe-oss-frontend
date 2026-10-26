'use client';

import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';

/**
 * How the Getting Started block shows: `default`, the list of steps, or
 * `collapsed`, the grid it folds into. Kept per user in localStorage, so a
 * folded block stays folded on the next page and in every other tab (the
 * `storage` event carries a change to the tabs already open).
 *
 * The key lives as long as the tour: "Start with Mingo" adds it (`default`)
 * when there is none, "Reset Onboarding" puts it back to `default`, and the
 * end of the tour (finished or skipped, here or on another device) removes it.
 * With no key the block decides from the progress (`getting-started-block.tsx`).
 */
export type GettingStartedView = 'default' | 'collapsed';

const KEY_PREFIX = 'openframe:getting-started-view:';

const listeners = new Set<() => void>();

/** Without a signed-in user (a session still loading) the view lives in memory only. */
let memoryView: GettingStartedView | null = null;

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function isView(value: unknown): value is GettingStartedView {
  return value === 'default' || value === 'collapsed';
}

function read(userId: string | undefined): GettingStartedView | null {
  if (!userId || typeof window === 'undefined') return memoryView;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    return isView(raw) ? raw : null;
  } catch {
    return null;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function write(userId: string | undefined, view: GettingStartedView | null): void {
  if (!userId || typeof window === 'undefined') {
    memoryView = view;
  } else {
    try {
      if (view) window.localStorage.setItem(keyFor(userId), view);
      else window.localStorage.removeItem(keyFor(userId));
    } catch {
      // Private mode / blocked storage: the view simply does not persist.
    }
  }
  notify();
}

/** The user folded or unfolded the block. */
export function setGettingStartedView(userId: string | undefined, view: GettingStartedView): void {
  write(userId, view);
}

/** "Start with Mingo": the tour begins as the list, unless it already has a view. */
export function ensureGettingStartedView(userId: string | undefined): void {
  if (read(userId) === null) write(userId, 'default');
}

/** "Reset Onboarding": the tour starts over, as the list. */
export function resetGettingStartedView(userId: string | undefined): void {
  write(userId, 'default');
}

/** The tour is over (finished or skipped): nothing left to remember. */
export function clearGettingStartedView(userId: string | undefined): void {
  write(userId, null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function getServerSnapshot(): GettingStartedView | null {
  return null;
}

/** The signed-in user's view of the block (null: none chosen yet) and its setter. */
export function useGettingStartedView(): [GettingStartedView | null, (view: GettingStartedView) => void] {
  const userId = useAuthStore(state => state.user?.id);
  const view = useSyncExternalStore(subscribe, () => read(userId), getServerSnapshot);
  return [view, next => setGettingStartedView(userId, next)];
}
