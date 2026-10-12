'use client';

import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';

/**
 * Where this user is in the Mingo tour - the handoff from the setup wizard to
 * the Getting Started block in the Mingo panel:
 *
 * - `startedAt`: "Start with Mingo" was pressed. Until then the wizard's last
 *   screen ("You are ready to go" / "Everything is set up") is what the
 *   dashboard redirects to.
 * - `dialogId`: the "Welcome to OpenFrame" conversation the tour lives in,
 *   created by the Mingo panel on the first landing after the wizard. The
 *   Getting Started block shows in that conversation only.
 * - `steps`: tour steps done on this device, for the steps the backend's
 *   `UserOnboardingStep` does not know yet; the known ones go to the server.
 *
 * TEMPORARY - this belongs on the backend as `userOnboardingProgress.tourDialogId`
 * plus the missing enum values (the marker has to follow the user to another
 * device). Until that ships the record is a per-user localStorage entry, read
 * through `useSyncExternalStore` so the redirect and the panel that depend on
 * it re-evaluate the moment it is written. Delete this module and read the
 * fields from the onboarding store once it lands.
 */

export interface TourState {
  startedAt: string;
  dialogId: string | null;
  steps: string[];
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
      const { startedAt, dialogId, steps } = record as Partial<TourState>;
      value = {
        startedAt: startedAt as string,
        dialogId: typeof dialogId === 'string' ? dialogId : null,
        steps: Array.isArray(steps) ? steps.filter((step): step is string => typeof step === 'string') : [],
      };
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
  write(userId, { startedAt: new Date().toISOString(), dialogId: null, steps: [] });
}

/** The panel created the tour's conversation (or found it gone - `null` asks for a new one). */
export function setTourDialog(userId: string | undefined, dialogId: string | null): void {
  const current = read(userId);
  if (!current || current.dialogId === dialogId) return;
  write(userId, { ...current, dialogId });
}

/** A tour step done on this device. */
export function markTourStepDone(userId: string | undefined, stepId: string): void {
  const current = read(userId);
  if (!current || current.steps.includes(stepId)) return;
  write(userId, { ...current, steps: [...current.steps, stepId] });
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
