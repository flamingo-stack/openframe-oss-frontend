import type ReactRelay from 'react-relay';
import { commitLocalUpdate, Environment, Network, RecordSource, type RecordSourceProxy, Store } from 'relay-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `graphql` tags are compiled away by the relay babel transform, which vitest
// does not run; the shared connection helper's module declares one.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof ReactRelay>()),
  graphql: () => ({}),
}));

import {
  BACKOFF_STEPS_MS,
  DEVICE_LOGS_CLOCK_SKEW_MS,
  deviceLogRowKey,
  emptyListPollFrom,
  type PolledLine,
  pollBackoffMs,
  prependNewerLines,
} from './device-log-tail';

/**
 * A poll's `from` is inclusive and its answer can repeat, so the updater must drop
 * what the list holds, never duplicate a row, and keep newest-first order —
 * pinned against a real relay-runtime store, not a mock of it.
 */

const CONNECTION = 'client:list';

let environment: Environment;

function update(updater: (store: RecordSourceProxy) => void): void {
  commitLocalUpdate(environment, updater);
}

/** A DeviceLogEntry record, as normalizing a response would leave it. */
function entry(store: RecordSourceProxy, id: string, timestamp: string) {
  const node = store.create(id, 'DeviceLogEntry');
  node.setValue(timestamp, 'timestamp');
  return node;
}

/** The list's connection holding these lines, newest first. */
function seedList(lines: readonly [string, string][]): void {
  update(store => {
    const connection = store.create(CONNECTION, 'DeviceLogConnection');
    connection.setLinkedRecords(
      lines.map(([id, timestamp]) => {
        const edge = store.create(`${id}:edge`, 'DeviceLogEdge');
        edge.setLinkedRecord(entry(store, id, timestamp), 'node');
        return edge;
      }),
      'edges',
    );
  });
}

/** A poll answer's lines, their records already in the store. */
function polled(lines: readonly [string, string][]): PolledLine[] {
  update(store => {
    for (const [id, timestamp] of lines) entry(store, id, timestamp);
  });
  return lines.map(([nodeId, timestamp]) => ({ nodeId, cursor: `cursor:${nodeId}`, timestamp }));
}

function prepend(lines: readonly PolledLine[]): number {
  let inserted = 0;
  update(store => {
    inserted = prependNewerLines(store, CONNECTION, lines);
  });
  return inserted;
}

function listIds(): string[] {
  let ids: string[] = [];
  update(store => {
    ids = (store.get(CONNECTION)?.getLinkedRecords('edges') ?? []).map(
      edge => edge?.getLinkedRecord('node')?.getDataID() ?? '?',
    );
  });
  return ids;
}

beforeEach(() => {
  environment = new Environment({
    network: Network.create(() => Promise.reject(new Error('no network in this test'))),
    store: new Store(new RecordSource()),
  });
});

describe('prependNewerLines', () => {
  it('drops the inclusive `from` line and prepends only newer ones, newest first', () => {
    seedList([['a', '2026-09-23T10:00:00Z']]);
    const lines = polled([
      ['c', '2026-09-23T10:00:02Z'],
      ['b', '2026-09-23T10:00:01Z'],
      ['a-again', '2026-09-23T10:00:00Z'],
    ]);

    expect(prepend(lines)).toBe(2);
    expect(listIds()).toEqual(['c', 'b', 'a']);
  });

  it('inserts nothing twice when the same answer is applied again', () => {
    seedList([['a', '2026-09-23T10:00:00Z']]);
    const lines = polled([['b', '2026-09-23T10:00:01Z']]);

    prepend(lines);
    expect(prepend(lines)).toBe(0);
    expect(listIds()).toEqual(['b', 'a']);
  });

  it('never links a record twice, even when the head has no readable timestamp to compare with', () => {
    update(store => {
      const connection = store.create(CONNECTION, 'DeviceLogConnection');
      const edge = store.create('odd:edge', 'DeviceLogEdge');
      edge.setLinkedRecord(store.create('odd', 'DeviceLogEntry'), 'node');
      connection.setLinkedRecords([edge], 'edges');
    });
    const lines = polled([['b', '2026-09-23T10:00:01Z']]);
    const unguardedHead = [{ nodeId: 'odd', cursor: 'x', timestamp: '2026-09-23T10:00:09Z' }];

    prepend(lines);
    expect(prepend(unguardedHead)).toBe(0);
    expect(listIds()).toEqual(['b', 'odd']);
  });

  it('keeps the cursor on the new edge, the key the row list is built on', () => {
    seedList([]);
    prepend(polled([['b', '2026-09-23T10:00:01Z']]));
    let cursor: unknown;
    update(store => {
      cursor = store.get(CONNECTION)?.getLinkedRecords('edges')?.[0]?.getValue('cursor');
    });
    expect(cursor).toBe('cursor:b');
  });

  it('fills an empty list with every polled line, in order', () => {
    seedList([]);
    expect(
      prepend(
        polled([
          ['b', '2026-09-23T10:00:01Z'],
          ['a', '2026-09-23T10:00:00Z'],
        ]),
      ),
    ).toBe(2);
    expect(listIds()).toEqual(['b', 'a']);
  });

  it('compares nanoseconds, not text: a 3-digit fraction can be the newer line', () => {
    // As text ".036Z" < ".007000000Z" is false the wrong way round.
    seedList([['a', '2026-09-23T10:00:00.007000000Z']]);
    expect(prepend(polled([['b', '2026-09-23T10:00:00.036Z']]))).toBe(1);
    expect(listIds()).toEqual(['b', 'a']);
  });

  it('is a no-op when the list connection is gone (refetched or unmounted)', () => {
    expect(prepend(polled([['b', '2026-09-23T10:00:01Z']]))).toBe(0);
  });

  it('skips a polled record the store no longer holds instead of linking a hole', () => {
    seedList([['a', '2026-09-23T10:00:00Z']]);
    expect(prepend([{ nodeId: 'collected', cursor: 'x', timestamp: '2026-09-23T10:00:05Z' }])).toBe(0);
    expect(listIds()).toEqual(['a']);
  });
});

describe('pollBackoffMs', () => {
  it('walks the ladder and then holds, so a long outage never runs off the end', () => {
    expect(pollBackoffMs(0)).toBe(BACKOFF_STEPS_MS[0]);
    expect(pollBackoffMs(1)).toBe(BACKOFF_STEPS_MS[1]);
    expect(pollBackoffMs(999)).toBe(BACKOFF_STEPS_MS[1]);
  });

  it('treats a negative counter as the first failure instead of indexing backwards', () => {
    expect(pollBackoffMs(-1)).toBe(BACKOFF_STEPS_MS[0]);
  });
});

describe('emptyListPollFrom', () => {
  const anchor = Date.parse('2026-09-23T10:00:00.000Z');
  const covered = new Date(anchor - DEVICE_LOGS_CLOCK_SKEW_MS).toISOString();

  it('re-reads only the skew allowance before the anchor, not the whole window', () => {
    expect(emptyListPollFrom(anchor, '2026-09-16T10:00:00.000Z')).toBe(covered);
  });

  it('never starts before the window itself', () => {
    expect(emptyListPollFrom(anchor, '2026-09-23T09:59:00.000Z')).toBe('2026-09-23T09:59:00.000Z');
  });

  it('keeps a window that begins after an old anchor: a custom day picked on a tab open since yesterday', () => {
    expect(emptyListPollFrom(anchor - 86_400_000, '2026-09-23T00:00:00.000Z')).toBe('2026-09-23T00:00:00.000Z');
  });

  it('falls back to the anchor for a missing or unreadable window start', () => {
    expect(emptyListPollFrom(anchor, undefined)).toBe(covered);
    expect(emptyListPollFrom(anchor, 'not-a-date')).toBe(covered);
  });
});

describe('deviceLogRowKey', () => {
  it('changes when a reload writes another line into the same record', () => {
    const before = deviceLogRowKey({ cursor: 'c-0', node: { timestamp: '2026-09-23T10:00:00Z' } });
    const after = deviceLogRowKey({ cursor: 'c-0', node: { timestamp: '2026-09-23T10:00:07Z' } });
    expect(after).not.toBe(before);
  });

  it('tells apart lines that share an instant by their cursor', () => {
    const first = deviceLogRowKey({ cursor: 'c-0', node: { timestamp: '2026-09-23T10:00:00Z' } });
    const second = deviceLogRowKey({ cursor: 'c-1', node: { timestamp: '2026-09-23T10:00:00Z' } });
    expect(first).not.toBe(second);
  });
});
