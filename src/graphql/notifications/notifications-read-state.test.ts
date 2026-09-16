import type ReactRelay from 'react-relay';
import {
  commitLocalUpdate,
  ConnectionHandler,
  Environment,
  getRelayHandleKey,
  Network,
  RecordSource,
  type RecordSourceSelectorProxy,
  Store,
} from 'relay-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `graphql` tags are compiled away by the relay babel transform, which vitest doesn't run;
// the tag would throw at module scope on import. Nothing here reads a fragment.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof ReactRelay>()),
  graphql: () => ({}),
}));

import { getLiveConnectionPairs, registerLiveConnectionPairs } from './live-connection-pairs';
import {
  makeDeleteNotificationUpdater,
  makeMarkReadUpdater,
  makeReadStateUpdater,
  type NotificationConnectionPair,
  NOTIFICATIONS_CONNECTION_KEY,
  notificationsConnectionFilters,
  type NotificationsConnectionFilters,
  UNFILTERED_NOTIFICATION_PAIR,
} from './notifications-helpers';

/**
 * A READ / DELETED live event runs the same store updaters as the user's own mutation, and
 * the backend publishes the event to the tab that fired the mutation too. So every updater
 * has to survive a second pass over the same notification — around Relay's optimistic
 * revert, in either order — without a duplicate row or a double-decremented badge.
 * Pinned against a real relay-runtime store, not a mock of it.
 */

const CATEGORY = 'TICKETS';
const SEARCH_PAIR: NotificationConnectionPair = {
  unread: notificationsConnectionFilters(false, 'dns'),
  read: notificationsConnectionFilters(true, 'dns'),
};

function makeEnvironment(): Environment {
  return new Environment({
    network: Network.create(() => Promise.reject(new Error('no network in this test'))),
    store: new Store(new RecordSource()),
  });
}

function update(environment: Environment, updater: (store: RecordSourceSelectorProxy) => void): void {
  commitLocalUpdate(environment, updater);
}

/** Materialise an empty connection under the root, the way a query response would. */
function createConnection(store: RecordSourceSelectorProxy, filters: NotificationsConnectionFilters): void {
  const handleKey = getRelayHandleKey('connection', NOTIFICATIONS_CONNECTION_KEY, null);
  const connId = `client:root:${handleKey}:${JSON.stringify(filters)}`;
  const conn = store.create(connId, 'NotificationConnection');
  conn.setLinkedRecords([], 'edges');
  const pageInfo = store.create(`${connId}:pageInfo`, 'PageInfo');
  pageInfo.setValue(false, 'hasNextPage');
  pageInfo.setValue(null, 'endCursor');
  conn.setLinkedRecord(pageInfo, 'pageInfo');
  store.getRoot().setLinkedRecord(conn, handleKey, filters);
}

function seedBuckets(store: RecordSourceSelectorProxy, count: number): void {
  const bucket = store.create(`client:UnreadCategoryCount:${CATEGORY}`, 'UnreadCategoryCount');
  bucket.setValue(CATEGORY, 'category');
  bucket.setValue(count, 'count');
  store.getRoot().setLinkedRecords([bucket], 'unreadCountsByCategory');
}

function seedUnread(store: RecordSourceSelectorProxy, id: string, filters: NotificationsConnectionFilters): void {
  const node = store.get(id) ?? store.create(id, 'Notification');
  node.setValue(id, 'id');
  node.setValue(false, 'read');
  node.setValue(CATEGORY, 'category');
  const conn = ConnectionHandler.getConnection(store.getRoot(), NOTIFICATIONS_CONNECTION_KEY, filters);
  if (!conn) throw new Error('connection not seeded');
  const edge = ConnectionHandler.createEdge(store, conn, node, 'NotificationEdge');
  ConnectionHandler.insertEdgeBefore(conn, edge);
}

function nodeIds(environment: Environment, filters: NotificationsConnectionFilters): string[] {
  let ids: string[] = [];
  update(environment, store => {
    const conn = ConnectionHandler.getConnection(store.getRoot(), NOTIFICATIONS_CONNECTION_KEY, filters);
    ids = (conn?.getLinkedRecords('edges') ?? []).flatMap(edge => {
      const id = edge?.getLinkedRecord('node')?.getDataID();
      return id ? [id] : [];
    });
  });
  return ids;
}

function unreadCount(environment: Environment): number {
  let count = -1;
  update(environment, store => {
    const buckets = store.getRoot().getLinkedRecords('unreadCountsByCategory') ?? [];
    const bucket = buckets.find(b => b?.getValue('category') === CATEGORY);
    count = Number(bucket?.getValue('count'));
  });
  return count;
}

function isRead(environment: Environment, id: string): boolean | undefined {
  let read: boolean | undefined;
  update(environment, store => {
    read = store.get(id)?.getValue('read') as boolean | undefined;
  });
  return read;
}

describe('a READ event', () => {
  let environment: Environment;

  beforeEach(() => {
    environment = makeEnvironment();
    update(environment, store => {
      createConnection(store, UNFILTERED_NOTIFICATION_PAIR.unread);
      createConnection(store, UNFILTERED_NOTIFICATION_PAIR.read);
      seedBuckets(store, 3);
      seedUnread(store, 'n-1', UNFILTERED_NOTIFICATION_PAIR.unread);
      seedUnread(store, 'n-2', UNFILTERED_NOTIFICATION_PAIR.unread);
    });
  });

  it('moves the card to history and frees its bucket', () => {
    update(environment, makeReadStateUpdater('READ', ['n-1'], [UNFILTERED_NOTIFICATION_PAIR]));

    expect(isRead(environment, 'n-1')).toBe(true);
    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.unread)).toEqual(['n-2']);
    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.read)).toEqual(['n-1']);
    expect(unreadCount(environment)).toBe(2);
  });

  it('is a no-op the second time — the echo of this tab’s own mark-read', () => {
    update(environment, makeMarkReadUpdater('n-1', [UNFILTERED_NOTIFICATION_PAIR]));
    update(environment, makeReadStateUpdater('READ', ['n-1'], [UNFILTERED_NOTIFICATION_PAIR]));

    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.read)).toEqual(['n-1']);
    expect(unreadCount(environment)).toBe(2);
  });

  it('handles a bulk mark-all as one event carrying every id', () => {
    update(environment, makeReadStateUpdater('READ', ['n-1', 'n-2'], [UNFILTERED_NOTIFICATION_PAIR]));

    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.unread)).toEqual([]);
    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.read)).toEqual(['n-2', 'n-1']);
    expect(unreadCount(environment)).toBe(1);
  });

  it('skips an id the store never loaded and leaves the bucket to the refetch', () => {
    update(environment, makeReadStateUpdater('READ', ['n-outside-window'], [UNFILTERED_NOTIFICATION_PAIR]));

    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.unread)).toEqual(['n-2', 'n-1']);
    expect(unreadCount(environment)).toBe(3);
  });

  it('reaches a search-keyed connection the page registered', () => {
    update(environment, store => {
      createConnection(store, SEARCH_PAIR.unread);
      createConnection(store, SEARCH_PAIR.read);
      seedUnread(store, 'n-1', SEARCH_PAIR.unread);
    });

    update(environment, makeReadStateUpdater('READ', ['n-1'], [UNFILTERED_NOTIFICATION_PAIR, SEARCH_PAIR]));

    expect(nodeIds(environment, SEARCH_PAIR.unread)).toEqual([]);
    expect(nodeIds(environment, SEARCH_PAIR.read)).toEqual(['n-1']);
    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.unread)).toEqual(['n-2']);
    // One card, one decrement — however many connections listed it.
    expect(unreadCount(environment)).toBe(2);
  });
});

describe('a DELETED event', () => {
  let environment: Environment;

  beforeEach(() => {
    environment = makeEnvironment();
    update(environment, store => {
      createConnection(store, UNFILTERED_NOTIFICATION_PAIR.unread);
      createConnection(store, UNFILTERED_NOTIFICATION_PAIR.read);
      seedBuckets(store, 2);
      seedUnread(store, 'n-1', UNFILTERED_NOTIFICATION_PAIR.unread);
    });
  });

  it('drops an unread card and frees its bucket', () => {
    update(environment, makeReadStateUpdater('DELETED', ['n-1'], [UNFILTERED_NOTIFICATION_PAIR]));

    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.unread)).toEqual([]);
    expect(unreadCount(environment)).toBe(1);
  });

  it('does not decrement again on the echo of this tab’s own delete', () => {
    update(environment, makeDeleteNotificationUpdater('n-1', [UNFILTERED_NOTIFICATION_PAIR]));
    update(environment, makeReadStateUpdater('DELETED', ['n-1'], [UNFILTERED_NOTIFICATION_PAIR]));

    expect(unreadCount(environment)).toBe(1);
  });

  it('drops a card from history without touching the bucket', () => {
    update(environment, makeMarkReadUpdater('n-1', [UNFILTERED_NOTIFICATION_PAIR]));
    expect(unreadCount(environment)).toBe(1);

    update(environment, makeReadStateUpdater('DELETED', ['n-1'], [UNFILTERED_NOTIFICATION_PAIR]));

    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.read)).toEqual([]);
    expect(unreadCount(environment)).toBe(1);
  });
});

describe('the live connection-pair registry', () => {
  it('always yields the unfiltered pair, then what mounted lists registered', () => {
    expect(getLiveConnectionPairs()).toEqual([UNFILTERED_NOTIFICATION_PAIR]);

    const unregister = registerLiveConnectionPairs([SEARCH_PAIR, UNFILTERED_NOTIFICATION_PAIR]);
    expect(getLiveConnectionPairs()).toEqual([UNFILTERED_NOTIFICATION_PAIR, SEARCH_PAIR, UNFILTERED_NOTIFICATION_PAIR]);

    unregister();
    expect(getLiveConnectionPairs()).toEqual([UNFILTERED_NOTIFICATION_PAIR]);
  });
});
