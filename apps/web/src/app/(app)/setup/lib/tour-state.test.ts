/**
 * The handoff marker: written by the wizard's "Start with Mingo", cleared by
 * "Reset Onboarding".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTourStarted, markTourStarted } from './tour-state';

const USER = 'u-1';
const KEY = `openframe:onboarding-tour:${USER}`;

/** An in-memory Storage: the test runtime's own `localStorage` has no backing file. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: index => [...map.keys()][index] ?? null,
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: key => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
}

let storage: Storage;
const stored = () => JSON.parse(storage.getItem(KEY) ?? 'null') as unknown;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tour state', () => {
  it('starts once', () => {
    markTourStarted(USER);
    const first = stored() as { startedAt: string };
    expect(typeof first.startedAt).toBe('string');

    // A second "Start with Mingo" (the wizard shown again) keeps the record.
    markTourStarted(USER);
    expect(stored()).toEqual(first);
  });

  it('is cleared with the rest of the progress, and ignores an unknown user', () => {
    markTourStarted(USER);
    clearTourStarted(USER);
    expect(stored()).toBeNull();

    markTourStarted(undefined);
    expect(storage.length).toBe(0);
  });
});
