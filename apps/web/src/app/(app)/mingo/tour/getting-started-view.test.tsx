/**
 * The Getting Started block's shape, kept per user in localStorage: added when
 * the tour starts, put back to the list on a reset, removed when the tour ends,
 * and read by every tab (a change in another tab arrives as a `storage` event).
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import {
  clearGettingStartedView,
  ensureGettingStartedView,
  resetGettingStartedView,
  setGettingStartedView,
  useGettingStartedView,
} from './getting-started-view';

const USER = 'u-1';
const KEY = `openframe:getting-started-view:${USER}`;

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

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the Getting Started view key', () => {
  it('starts the tour as the list, keeping a view the tour already has', () => {
    ensureGettingStartedView(USER);
    expect(storage.getItem(KEY)).toBe('default');

    setGettingStartedView(USER, 'collapsed');
    ensureGettingStartedView(USER);
    expect(storage.getItem(KEY)).toBe('collapsed');
  });

  it('a reset puts the list back, whatever the user had chosen', () => {
    setGettingStartedView(USER, 'collapsed');
    resetGettingStartedView(USER);
    expect(storage.getItem(KEY)).toBe('default');
  });

  it('the end of the tour removes it', () => {
    setGettingStartedView(USER, 'collapsed');
    clearGettingStartedView(USER);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it('is kept per user', () => {
    setGettingStartedView(USER, 'collapsed');
    setGettingStartedView('u-2', 'default');
    expect(storage.getItem(KEY)).toBe('collapsed');
    expect(storage.getItem('openframe:getting-started-view:u-2')).toBe('default');
  });
});

describe('useGettingStartedView', () => {
  let container: HTMLDivElement;
  let root: Root;
  let seen: Array<string | null>;

  function Probe() {
    const [view] = useGettingStartedView();
    seen.push(view);
    return null;
  }

  beforeEach(() => {
    seen = [];
    useAuthStore.setState({ user: { id: USER, email: 'ann@example.com' } } as never);
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    useAuthStore.setState({ user: null } as never);
  });

  it("reads the signed-in user's view, and follows a change made in another tab", () => {
    storage.setItem(KEY, 'collapsed');
    act(() => root.render(<Probe />));
    expect(seen.at(-1)).toBe('collapsed');

    // Another tab unfolds it: this tab's storage changes and a `storage` event says so.
    storage.setItem(KEY, 'default');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(seen.at(-1)).toBe('default');
  });

  it('ignores a value it does not know', () => {
    storage.setItem(KEY, 'sideways');
    act(() => root.render(<Probe />));
    expect(seen.at(-1)).toBeNull();
  });
});
