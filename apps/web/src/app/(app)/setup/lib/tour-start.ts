'use client';

import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';

/**
 * Whether this user has pressed "Start with Mingo" - the handoff from the setup
 * wizard to the Getting Started tour in the Mingo panel. Until then the wizard's
 * last screen ("You are ready to go" / "Everything is set up") is what the
 * dashboard redirects to.
 *
 * TEMPORARY - this belongs on the backend as `userOnboardingProgress.tourDialogId`
 * (the dialog the tour lives in doubles as the marker, and it has to follow the
 * user to another device). Until that field ships the marker is a per-user
 * localStorage flag, read through `useSyncExternalStore` so the redirect that
 * depends on it re-evaluates the moment it is written. Delete this module and
 * read the field from the onboarding store once it lands.
 */

const KEY_PREFIX = 'openframe:onboarding-tour-started:';

const listeners = new Set<() => void>();

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function read(userId: string | undefined): boolean {
  if (!userId || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(keyFor(userId)) === '1';
  } catch {
    return false;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function write(userId: string | undefined, started: boolean): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    if (started) {
      window.localStorage.setItem(keyFor(userId), '1');
    } else {
      window.localStorage.removeItem(keyFor(userId));
    }
  } catch {
    // Private mode / blocked storage: the marker simply does not persist.
  }
  notify();
}

export function markTourStarted(userId: string | undefined): void {
  write(userId, true);
}

/** "Reset Onboarding" clears it with the rest of the user's progress. */
export function clearTourStarted(userId: string | undefined): void {
  write(userId, false);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function getServerSnapshot(): boolean {
  return false;
}

export function useTourStarted(): boolean {
  const userId = useAuthStore(state => state.user?.id);
  return useSyncExternalStore(subscribe, () => read(userId), getServerSnapshot);
}
