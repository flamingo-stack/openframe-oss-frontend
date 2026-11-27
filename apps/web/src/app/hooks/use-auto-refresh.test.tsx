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
    ['refetches at once', 7 * 60_000, 0],
    ['waits the rest of the interval', 2 * 60_000, 3 * 60_000],
  ])('back on a hidden tab, %s (5m)', async (_, hiddenFor, wait) => {
    state.refresh = '5m';
    const refetch = vi.fn(() => Promise.resolve());
    mount(refetch);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    // Hidden for a while, then shown again.
    const show = (visibility: 'hidden' | 'visible') =>
      act(() => {
        Object.defineProperty(document, 'visibilityState', { value: visibility, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    show('hidden');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(hiddenFor);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    show('visible');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.max(0, wait - 1));
    });
    expect(refetch).toHaveBeenCalledTimes(wait === 0 ? 2 : 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
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
