import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type ReactRelay from 'react-relay';
import { RelayEnvironmentProvider } from 'react-relay';
import {
  commitLocalUpdate,
  Environment,
  Network,
  Observable,
  RecordSource,
  type RecordSourceProxy,
  Store,
} from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `graphql` tags are compiled away by the relay babel transform, which vitest does
// not run; the CommonJS build keeps the named exports on `default`.
vi.mock('react-relay', async importOriginal => {
  const actual = await importOriginal<typeof ReactRelay & { default?: typeof ReactRelay }>();
  return { ...actual, ...actual.default, graphql: () => ({}) };
});

let subscriptionOpen = true;
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({
  useSubscriptionOpen: () => subscriptionOpen,
}));

import type { DeviceLogErrorInfo } from '../utils/device-log-errors';
import type { PolledPage } from '../utils/device-log-tail';
import { DEVICE_LOGS_POLL_INTERVAL_MS, useDeviceLogsLiveTail } from './use-device-logs-live-tail';

/**
 * The auto-update runs unattended, so its failures are traffic and leaks: two
 * requests in flight, polling while hidden or scrolled away, a timer outliving
 * the tab, a gap papered over. Pinned against a real Relay store.
 */

const CONNECTION = 'client:list';

/** What `Observable.create` hands its source; relay-runtime does not export the name. */
type PollSink = Parameters<Parameters<typeof Observable.create<PolledPage>>[0]>[0];

interface Call {
  from: string;
  sink: PollSink;
  unsubscribed: boolean;
}

let environment: Environment;
let calls: Call[];
let container: HTMLDivElement;
let root: Root;
let latest: { error: DeviceLogErrorInfo | null } | null;
let visibility: DocumentVisibilityState;
const onGap = vi.fn();

const fetchNewer = (from: string) =>
  Observable.create<PolledPage>(sink => {
    const call: Call = { from, sink, unsubscribed: false };
    calls.push(call);
    return () => {
      call.unsubscribed = true;
    };
  });

interface ProbeProps {
  enabled?: boolean;
  atTop?: boolean;
  newestTimestamp?: string | null;
  windowStart?: string;
  windowEnd?: string;
}

function Probe({ enabled = true, atTop = true, newestTimestamp = null, windowStart, windowEnd }: ProbeProps) {
  const result = useDeviceLogsLiveTail({
    connectionId: CONNECTION,
    fetchNewer,
    newestTimestamp,
    windowStart,
    windowEnd,
    hasSearch: false,
    enabled,
    atTop,
    onGap,
  });
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = result;
  });
  return null;
}

function render(props: ProbeProps = {}) {
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <Probe {...props} />
      </RelayEnvironmentProvider>,
    );
  });
}

function tick(ms = DEVICE_LOGS_POLL_INTERVAL_MS) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Answers the in-flight request with lines whose records the store holds, like a normalized response. */
function answer(call: Call, lines: [string, string][], gap = false) {
  commitLocalUpdate(environment, store => {
    for (const [id, timestamp] of lines) store.create(id, 'DeviceLogEntry').setValue(timestamp, 'timestamp');
  });
  act(() => {
    call.sink.next({ gap, lines: lines.map(([nodeId, timestamp]) => ({ nodeId, cursor: nodeId, timestamp })) });
    call.sink.complete();
  });
}

function listIds(): string[] {
  let ids: string[] = [];
  commitLocalUpdate(environment, (store: RecordSourceProxy) => {
    ids = (store.get(CONNECTION)?.getLinkedRecords('edges') ?? []).map(
      edge => edge?.getLinkedRecord('node')?.getDataID() ?? '?',
    );
  });
  return ids;
}

beforeEach(() => {
  vi.useFakeTimers();
  environment = new Environment({
    network: Network.create(() => Promise.reject(new Error('no network in this test'))),
    store: new Store(new RecordSource()),
  });
  commitLocalUpdate(environment, store => {
    const connection = store.create(CONNECTION, 'DeviceLogConnection');
    const edge = store.create('a:edge', 'DeviceLogEdge');
    const node = store.create('a', 'DeviceLogEntry');
    node.setValue('2026-09-23T10:00:00Z', 'timestamp');
    edge.setLinkedRecord(node, 'node');
    connection.setLinkedRecords([edge], 'edges');
  });
  calls = [];
  latest = null;
  subscriptionOpen = true;
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  onGap.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('useDeviceLogsLiveTail', () => {
  it('asks from the newest line and writes the answer into the list, dropping the inclusive line', () => {
    render({ newestTimestamp: '2026-09-23T10:00:00Z' });
    tick();
    expect(calls.map(call => call.from)).toEqual(['2026-09-23T10:00:00Z']);

    answer(calls[0], [
      ['b', '2026-09-23T10:00:01Z'],
      ['a-again', '2026-09-23T10:00:00Z'],
    ]);
    expect(listIds()).toEqual(['b', 'a']);
  });

  it('starts an empty list from the window start, not the API default', () => {
    render({ windowStart: '2026-09-23T09:00:00.000Z' });
    tick();
    expect(calls[0]?.from).toBe('2026-09-23T09:00:00.000Z');
  });

  it('never has two requests in flight, even when the tab is re-shown mid-request', () => {
    render();
    tick();
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    tick(DEVICE_LOGS_POLL_INTERVAL_MS * 10);
    expect(calls).toHaveLength(1);
  });

  it('asks again one interval after an answer, not before', () => {
    render();
    tick();
    answer(calls[0], []);
    tick(DEVICE_LOGS_POLL_INTERVAL_MS - 1);
    expect(calls).toHaveLength(1);
    tick(1);
    expect(calls).toHaveLength(2);
  });

  it('sends nothing while scrolled away, switched off or behind the paywall', () => {
    render({ atTop: false });
    tick(60_000);
    render({ enabled: false });
    tick(60_000);
    subscriptionOpen = false;
    render();
    tick(60_000);
    expect(calls).toHaveLength(0);
  });

  it('sends nothing while the tab is hidden, and resumes when it is shown', () => {
    visibility = 'hidden';
    render();
    tick(60_000);
    expect(calls).toHaveLength(0);

    visibility = 'visible';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    tick();
    expect(calls).toHaveLength(1);
  });

  it('never polls a custom range that has already ended', () => {
    render({ windowEnd: '2020-01-01T00:00:00.000Z' });
    tick(60_000);
    expect(calls).toHaveLength(0);
  });

  it('hands a full page to the list as a gap instead of inserting a partial run', () => {
    render({ newestTimestamp: '2026-09-23T10:00:00Z' });
    tick();
    answer(calls[0], [['b', '2026-09-23T10:00:01Z']], true);
    expect(onGap).toHaveBeenCalledTimes(1);
    expect(listIds()).toEqual(['a']);
  });

  it('reports a failure, backs off 15 s then 30 s, and clears it on recovery', () => {
    render();
    tick();
    act(() => calls[0].sink.error(new Error('Relay fetch failed: 503')));
    expect(latest?.error?.kind).toBe('generic');

    tick(15_000 - 1);
    expect(calls).toHaveLength(1);
    tick(1);
    act(() => calls[1].sink.error(new Error('Relay fetch failed: 503')));
    tick(30_000);
    expect(calls).toHaveLength(3);

    answer(calls[2], []);
    expect(latest?.error).toBeNull();
  });

  it('stops for good when the device is gone — waiting cannot fix it', () => {
    render();
    tick();
    const gone = Object.assign(new Error('No data'), {
      source: { errors: [{ message: 'Machine not found', extensions: { code: 'DEVICE_NOT_FOUND' } }] },
    });
    act(() => calls[0].sink.error(gone));
    expect(latest?.error?.kind).toBe('not-found');
    tick(120_000);
    expect(calls).toHaveLength(1);
  });

  it('cancels the request in flight and its timer when the tab goes away', () => {
    render();
    tick();
    act(() => root.unmount());
    expect(calls[0].unsubscribed).toBe(true);
    tick(60_000);
    expect(calls).toHaveLength(1);
    root = createRoot(container);
  });
});
