// The skeletons stand in for the list while the first page (or the device) loads,
// so they must render the list's own top — a day header — over a bounded set of rows.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentLogsListSkeleton, AgentLogsRowsSkeleton, AgentLogsTabSkeleton } from './agent-logs-skeleton';

// jsdom has no `ResizeObserver` (core `CheckboxBlock` measures its label); nothing here needs it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

/** Rows carry the chip-height slot (`h-8`); nothing else in the skeleton does. */
const rowCount = () => container.querySelectorAll('.h-8').length;

describe('agent logs skeletons', () => {
  it('draws exactly the rows it is asked for', () => {
    act(() => {
      root.render(<AgentLogsRowsSkeleton rows={3} />);
    });
    expect(rowCount()).toBe(3);
  });

  it('opens the first-page skeleton with one day header over the default rows', () => {
    act(() => {
      root.render(<AgentLogsListSkeleton />);
    });
    expect(container.querySelectorAll('.text-h5')).toHaveLength(1);
    expect(rowCount()).toBe(12);
  });

  it('draws the real toolbar, locked, while the device loads', () => {
    act(() => {
      root.render(<AgentLogsTabSkeleton />);
    });
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Search agent logs"]')?.disabled).toBe(true);
    const chips = container.querySelectorAll<HTMLButtonElement>('[aria-label="Log levels"] button');
    expect(chips).toHaveLength(4);
    expect([...chips].every(chip => chip.disabled)).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Refresh logs"]')?.disabled).toBe(true);
  });
});
