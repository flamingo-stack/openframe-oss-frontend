/**
 * The tour record: started by the wizard, given its conversation by the panel,
 * extended with the steps done on this device, cleared by "Reset Onboarding".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTourStarted, markTourStarted, markTourStepDone, setTourDialog } from './tour-state';

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
  it('starts once, with no conversation and no steps', () => {
    markTourStarted(USER);
    const first = stored() as { startedAt: string; dialogId: null; steps: string[] };
    expect(first.dialogId).toBeNull();
    expect(first.steps).toEqual([]);
    expect(typeof first.startedAt).toBe('string');

    // A second "Start with Mingo" (the wizard shown again) keeps the record.
    markTourStarted(USER);
    expect(stored()).toEqual(first);
  });

  it('remembers the conversation and the steps done here', () => {
    markTourStarted(USER);
    setTourDialog(USER, 'd-1');
    markTourStepDone(USER, 'devices');
    markTourStepDone(USER, 'devices');
    markTourStepDone(USER, 'logs');
    expect(stored()).toMatchObject({ dialogId: 'd-1', steps: ['devices', 'logs'] });

    // The conversation is gone: the next pass creates a new one.
    setTourDialog(USER, null);
    expect(stored()).toMatchObject({ dialogId: null, steps: ['devices', 'logs'] });
  });

  it('records nothing before the tour has started', () => {
    setTourDialog(USER, 'd-1');
    markTourStepDone(USER, 'devices');
    expect(stored()).toBeNull();
  });

  it('is cleared with the rest of the progress, and ignores an unknown user', () => {
    markTourStarted(USER);
    clearTourStarted(USER);
    expect(stored()).toBeNull();

    markTourStarted(undefined);
    expect(storage.length).toBe(0);
  });
});
