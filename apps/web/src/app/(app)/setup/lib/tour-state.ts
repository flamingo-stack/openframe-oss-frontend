'use client';

import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';

/**
 * "Start with Mingo" was pressed on this device: the handoff from the setup
 * wizard to the Mingo panel. The wizard leaves for the dashboard before the
 * panel has created the tour's conversation, and the dashboard redirect would
 * send the user straight back to the wizard without this marker. The lasting
 * record is the server's `userOnboardingProgress.tourDialogId`, written once
 * the panel has created that conversation; the marker only bridges the gap,
 * and keeps when the tour began for Mingo's greeting.
 *
 * A per-user localStorage entry, read through `useSyncExternalStore` so the
 * redirect and the panel re-evaluate the moment it is written.
 */

export interface TourState {
  startedAt: string;
}

const KEY_PREFIX = 'openframe:onboarding-tour:';

const listeners = new Set<() => void>();

/** Parsed records by raw string, so an unchanged entry keeps its identity for `useSyncExternalStore`. */
const parsed = new Map<string, TourState | null>();

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function parse(raw: string): TourState | null {
  const cached = parsed.get(raw);
  if (cached !== undefined) return cached;
  let value: TourState | null = null;
  try {
    const record: unknown = JSON.parse(raw);
    if (record && typeof record === 'object' && typeof (record as TourState).startedAt === 'string') {
      value = { startedAt: (record as TourState).startedAt };
    }
  } catch {
    value = null;
  }
  parsed.clear();
  parsed.set(raw, value);
  return value;
}

function read(userId: string | undefined): TourState | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    return raw ? parse(raw) : null;
  } catch {
    return null;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function write(userId: string | undefined, state: TourState | null): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    if (state) {
      window.localStorage.setItem(keyFor(userId), JSON.stringify(state));
    } else {
      window.localStorage.removeItem(keyFor(userId));
    }
  } catch {
    // Private mode / blocked storage: the marker simply does not persist.
  }
  notify();
}

/** "Start with Mingo": the tour begins, its conversation is still to be created. */
export function markTourStarted(userId: string | undefined): void {
  if (read(userId)) return;
  write(userId, { startedAt: new Date().toISOString() });
}

/** "Reset Onboarding" clears it with the rest of the user's progress. */
export function clearTourStarted(userId: string | undefined): void {
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

function getServerSnapshot(): TourState | null {
  return null;
}

export function useTourState(): TourState | null {
  const userId = useAuthStore(state => state.user?.id);
  return useSyncExternalStore(subscribe, () => read(userId), getServerSnapshot);
}

export function useTourStarted(): boolean {
  return useTourState() !== null;
}
