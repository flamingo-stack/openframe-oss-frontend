/** The table auto-refresh: it ticks on its interval, one request at a time, and only while every gate is open. */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoRefresh } from './use-auto-refresh';

const state = vi.hoisted(() => ({ refresh: '10s', subscriptionOpen: true, health: 'healthy' as string }));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useApiParams: () => ({ params: { refresh: state.refresh }, setParam: vi.fn() }),
}));
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({
  useSubscriptionOpen: () => state.subscriptionOpen,
}));
vi.mock('@/lib/session-health', () => ({
  useSessionHealthStore: (select: (s: { health: string }) => unknown) => select({ health: state.health }),
  getSessionHealth: () => state.health,
}));

let root: Root;

function Table({ refetch }: { refetch: () => Promise<unknown> }) {
  useAutoRefresh({ prefix: 'sw', refetch });
  return null;
}

function mount(refetch: () => Promise<unknown>) {
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Table refetch={refetch} />));
}

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(state, { refresh: '10s', subscriptionOpen: true, health: 'healthy' });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it('refetches on its interval', async () => {
    const refetch = vi.fn(() => Promise.resolve());
    mount(refetch);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('keeps one request in flight: the next tick waits for the last answer', async () => {
    let resolve: () => void = () => {};
    const refetch = vi.fn(
      () =>
        new Promise<void>(r => {
          resolve = r;
        }),
    );
    mount(refetch);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve();
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['off', () => Object.assign(state, { refresh: 'off' })],
    ['a value it cannot read', () => Object.assign(state, { refresh: '5h' })],
    ['a paused session', () => Object.assign(state, { health: 'paused' })],
    ['a locked subscription', () => Object.assign(state, { subscriptionOpen: false })],
    ['a hidden tab', () => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })],
  ])('does not tick with %s', async (_, close) => {
    close();
    const refetch = vi.fn(() => Promise.resolve());
    mount(refetch);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(refetch).not.toHaveBeenCalled();
  });
});
