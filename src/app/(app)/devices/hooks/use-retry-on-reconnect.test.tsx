// A page lost offline has no Retry button, so the reconnect IS the retry: it must
// fire on the link's return (also one that returned before the subscription),
// never while still offline, and never after the wait is over.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let online = false;
const listeners = new Set<(value: boolean) => void>();
vi.mock('@/lib/connectivity', () => ({
  subscribeConnectivity: (listener: (value: boolean) => void) => {
    listeners.add(listener);
    listener(online);
    return () => listeners.delete(listener);
  },
}));

import { useRetryOnReconnect } from './use-retry-on-reconnect';

const retry = vi.fn();
let container: HTMLDivElement;
let root: Root;

function Probe({ waiting }: { waiting: boolean }) {
  useRetryOnReconnect(waiting, retry);
  return null;
}

const render = (waiting: boolean) =>
  act(() => {
    root.render(<Probe waiting={waiting} />);
  });
const setOnline = (value: boolean) =>
  act(() => {
    online = value;
    for (const listener of listeners) listener(value);
  });

beforeEach(() => {
  online = false;
  listeners.clear();
  retry.mockReset();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
});

describe('useRetryOnReconnect', () => {
  it('retries when the link comes back, not before', () => {
    render(true);
    expect(retry).not.toHaveBeenCalled();
    setOnline(true);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('retries at once when the link was already back by the time the wait began', () => {
    online = true;
    render(true);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('does nothing when nothing is waiting, and stops listening once the wait ends', () => {
    render(false);
    setOnline(true);
    expect(retry).not.toHaveBeenCalled();

    setOnline(false);
    render(true);
    render(false);
    setOnline(true);
    expect(retry).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
