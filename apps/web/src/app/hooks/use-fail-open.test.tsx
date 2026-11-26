// Pins `useFailOpen`, the rule every wait that only waits for an answer follows (the chrome, the landing hold, the
// device status gate, the session check): loading until the answer lands or the window passes, a fresh window for a
// later load, and one console warning when a labelled wait gives up.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAIL_OPEN_AFTER_MS, useFailOpen } from './use-fail-open';

let container: HTMLDivElement;
let root: Root;
let warn: ReturnType<typeof vi.spyOn>;

function Probe({ loading, label }: { loading: boolean; label?: string }) {
  return <p data-loading={String(useFailOpen(loading, 1_000, label))} />;
}

const loading = () => container.querySelector('p')?.getAttribute('data-loading');
const render = (props: { loading: boolean; label?: string }) => act(() => root.render(<Probe {...props} />));

beforeEach(() => {
  vi.useFakeTimers();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  warn.mockRestore();
  vi.useRealTimers();
});

describe('useFailOpen', () => {
  it('is sized like the session latch: ten seconds', () => {
    expect(FAIL_OPEN_AFTER_MS).toBe(10_000);
  });

  it('stays loading until the window passes, then lets go', () => {
    render({ loading: true });
    act(() => vi.advanceTimersByTime(999));
    expect(loading()).toBe('true');
    act(() => vi.advanceTimersByTime(1));
    expect(loading()).toBe('false');
  });

  it('lets go the moment the answer lands', () => {
    render({ loading: true });
    render({ loading: false });
    expect(loading()).toBe('false');
    act(() => vi.advanceTimersByTime(5_000));
    expect(loading()).toBe('false');
  });

  it('gives a later load its own full window', () => {
    render({ loading: true });
    act(() => vi.advanceTimersByTime(1_000));
    render({ loading: false });
    render({ loading: true });
    expect(loading()).toBe('true');
    act(() => vi.advanceTimersByTime(999));
    expect(loading()).toBe('true');
    act(() => vi.advanceTimersByTime(1));
    expect(loading()).toBe('false');
  });

  it('warns once when a labelled wait gives up, and never for an unlabelled one', () => {
    render({ loading: true, label: 'flags' });
    act(() => vi.advanceTimersByTime(1_000));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('[fail-open] flags');
    act(() => root.unmount());
    root = createRoot(container);
    warn.mockClear();
    render({ loading: true });
    act(() => vi.advanceTimersByTime(1_000));
    expect(warn).not.toHaveBeenCalled();
  });
});
