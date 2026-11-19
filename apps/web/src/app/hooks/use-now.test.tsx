/** The ticking clock: it re-samples on its interval, and stops while it is told not to tick. */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './use-now';

let container: HTMLDivElement;
let root: Root;

function Clock({ ticking }: { ticking: boolean }) {
  return <output>{useNow(1_000, ticking)}</output>;
}

const shown = () => Number(container.textContent);

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('useNow', () => {
  it('re-samples the clock on its interval', () => {
    act(() => root.render(<Clock ticking />));
    expect(shown()).toBe(0);
    act(() => vi.advanceTimersByTime(3_000));
    expect(shown()).toBe(3_000);
  });

  it('holds its last sample while not ticking, and resumes when ticking again', () => {
    act(() => root.render(<Clock ticking={false} />));
    act(() => vi.advanceTimersByTime(5_000));
    expect(shown()).toBe(0);

    act(() => root.render(<Clock ticking />));
    act(() => vi.advanceTimersByTime(1_000));
    expect(shown()).toBe(6_000);
  });
});
