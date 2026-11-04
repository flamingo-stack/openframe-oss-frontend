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
 *
 * Beside it, whether the user closed the block (its ×): the tour's conversation is
 * then set aside as any other chat is, and the block shows only where that
 * conversation is on screen (the sheet, its page), no longer over every page.
 * Kept the same way and for the same time: "Reset Onboarding" and the end of the
 * tour drop it.
 */
export type GettingStartedView = 'default' | 'collapsed';

const KEY_PREFIX = 'openframe:getting-started-view:';
const ASIDE_KEY_PREFIX = 'openframe:getting-started-aside:';

const listeners = new Set<() => void>();

/** Without a signed-in user (a session still loading) the view lives in memory only. */
let memoryView: GettingStartedView | null = null;
let memoryAside = false;

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function asideKeyFor(userId: string): string {
  return `${ASIDE_KEY_PREFIX}${userId}`;
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

function readAside(userId: string | undefined): boolean {
  if (!userId || typeof window === 'undefined') return memoryAside;
  try {
    return window.localStorage.getItem(asideKeyFor(userId)) !== null;
  } catch {
    return false;
  }
}

function writeAside(userId: string | undefined, aside: boolean): void {
  if (!userId || typeof window === 'undefined') {
    memoryAside = aside;
  } else {
    try {
      if (aside) window.localStorage.setItem(asideKeyFor(userId), '1');
      else window.localStorage.removeItem(asideKeyFor(userId));
    } catch {
      // Private mode / blocked storage: the block is back over the pages next time.
    }
  }
  notify();
}

/** The user folded or unfolded the block. */
export function setGettingStartedView(userId: string | undefined, view: GettingStartedView): void {
  write(userId, view);
}

/** The user closed the block: from now on it shows only where its conversation is on screen. */
export function setGettingStartedAside(userId: string | undefined): void {
  writeAside(userId, true);
}

/** "Start with Mingo": the tour begins as the list, unless it already has a view. */
export function ensureGettingStartedView(userId: string | undefined): void {
  if (read(userId) === null) write(userId, 'default');
}

/** "Reset Onboarding": the tour starts over, as the list, over the pages again. */
export function resetGettingStartedView(userId: string | undefined): void {
  writeAside(userId, false);
  write(userId, 'default');
}

/** The tour is over (finished or skipped): nothing left to remember. */
export function clearGettingStartedView(userId: string | undefined): void {
  writeAside(userId, false);
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

function getServerAsideSnapshot(): boolean {
  return false;
}

/** The signed-in user's view of the block (null: none chosen yet) and its setter. */
export function useGettingStartedView(): [GettingStartedView | null, (view: GettingStartedView) => void] {
  const userId = useAuthStore(state => state.user?.id);
  const view = useSyncExternalStore(subscribe, () => read(userId), getServerSnapshot);
  return [view, next => setGettingStartedView(userId, next)];
}

/** Whether the signed-in user closed the block, and the way to close it. */
export function useGettingStartedAside(): [boolean, () => void] {
  const userId = useAuthStore(state => state.user?.id);
  const aside = useSyncExternalStore(subscribe, () => readAside(userId), getServerAsideSnapshot);
  return [aside, () => setGettingStartedAside(userId)];
}
