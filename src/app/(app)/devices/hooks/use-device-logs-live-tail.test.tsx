import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Observable } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let subscriptionOpen = true;
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({
  useSubscriptionOpen: () => subscriptionOpen,
}));

import {
  DEVICE_LOGS_POLL_INTERVAL_MS,
  DEVICE_LOGS_RETRY_INTERVAL_MS,
  useDeviceLogsLiveTail,
} from './use-device-logs-live-tail';

type Sink = Parameters<Parameters<typeof Observable.create<null>>[0]>[0];

let sinks: { sink: Sink; unsubscribed: boolean }[];
let latest: { failed: boolean } | null;
let visibility: DocumentVisibilityState;
let container: HTMLDivElement;
let root: Root;

const reload = () =>
  Observable.create<null>(sink => {
    const call = { sink, unsubscribed: false };
    sinks.push(call);
    return () => {
      call.unsubscribed = true;
    };
  });

function Probe({ enabled = true, atTop = true }: { enabled?: boolean; atTop?: boolean }) {
  const result = useDeviceLogsLiveTail({ reload, enabled, atTop });
  useEffect(() => {
    latest = result;
  });
  return null;
}

const render = (props: { enabled?: boolean; atTop?: boolean } = {}) =>
  act(() => {
    root.render(<Probe {...props} />);
  });
const tick = (ms = DEVICE_LOGS_POLL_INTERVAL_MS) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const complete = (index: number) =>
  act(() => {
    sinks[index].sink.complete();
  });

beforeEach(() => {
  vi.useFakeTimers();
  sinks = [];
  latest = null;
  subscriptionOpen = true;
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('useDeviceLogsLiveTail', () => {
  it('reloads every interval, one request at a time', () => {
    render();
    tick();
    expect(sinks).toHaveLength(1);
    tick(DEVICE_LOGS_POLL_INTERVAL_MS * 3);
    expect(sinks).toHaveLength(1);
    complete(0);
    tick(DEVICE_LOGS_POLL_INTERVAL_MS - 1);
    expect(sinks).toHaveLength(1);
    tick(1);
    expect(sinks).toHaveLength(2);
  });

  it('sends nothing while switched off, scrolled away, locked or hidden', () => {
    render({ enabled: false });
    tick(60_000);
    render({ atTop: false });
    tick(60_000);
    subscriptionOpen = false;
    render();
    tick(60_000);
    subscriptionOpen = true;
    visibility = 'hidden';
    render();
    tick(60_000);
    expect(sinks).toHaveLength(0);

    visibility = 'visible';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    tick(0);
    expect(sinks).toHaveLength(1);
  });

  it('reports a failure and waits longer before the next reload', () => {
    render();
    tick();
    act(() => sinks[0].sink.error(new Error('503')));
    expect(latest?.failed).toBe(true);
    tick(DEVICE_LOGS_RETRY_INTERVAL_MS - 1);
    expect(sinks).toHaveLength(1);
    tick(1);
    expect(sinks).toHaveLength(2);
    complete(1);
    expect(latest?.failed).toBe(false);
  });

  it('cancels the request in flight and its timer on unmount', () => {
    render();
    tick();
    act(() => root.unmount());
    expect(sinks[0].unsubscribed).toBe(true);
    tick(60_000);
    expect(sinks).toHaveLength(1);
    root = createRoot(container);
  });
});
