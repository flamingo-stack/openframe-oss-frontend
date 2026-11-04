import type ReactRelay from 'react-relay';
import { commitLocalUpdate, ConnectionHandler, type Environment, type RecordSourceSelectorProxy } from 'relay-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `graphql` tags are compiled away by the relay babel transform, which vitest doesn't run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof ReactRelay>()),
  graphql: () => ({}),
}));

import { entityScopeLabel } from '@/app/(app)/notifications/components/entity-scope-label';
import { NotificationEntityType, NotificationReadStatus } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { createConnection, makeOfflineEnvironment, nodeIds } from './__tests__/store-fixtures';
import {
  makeMarkEntityReadUpdater,
  type NotificationConnectionPair,
  NOTIFICATIONS_CONNECTION_KEY,
  notificationsConnectionFilters,
  type NotificationsConnectionFilters,
  parseNotificationEntityScope,
  setReadStatus,
  UNFILTERED_NOTIFICATION_PAIR,
} from './notifications-helpers';

const DEVICE = { type: NotificationEntityType.DEVICE, id: 'm-1' };

describe('a scope in the connection filters', () => {
  it('leaves the unscoped filter exactly as the drawer has always keyed it', () => {
    expect(notificationsConnectionFilters(false, '')).toEqual({ filter: { read: false }, search: null });
    expect('entity' in notificationsConnectionFilters(false, '', null).filter).toBe(false);
  });

  it('carries the entity as the backend filter takes it', () => {
    expect(notificationsConnectionFilters(true, ' dns ', DEVICE)).toEqual({
      filter: { read: true, entity: { type: 'DEVICE', id: 'm-1' } },
      search: 'dns',
    });
  });
});

describe('the scope a URL asks for', () => {
  it('is a known entity type with an id', () => {
    expect(parseNotificationEntityScope('DEVICE', 'm-1')).toEqual(DEVICE);
    expect(parseNotificationEntityScope('INSIGHT', 'i-1')).toEqual({ type: 'INSIGHT', id: 'i-1' });
  });

  it('is nothing for an unknown type or a missing id', () => {
    expect(parseNotificationEntityScope('PRINTER', 'm-1')).toBeNull();
    expect(parseNotificationEntityScope('DEVICE', '')).toBeNull();
    expect(parseNotificationEntityScope('', '')).toBeNull();
  });

  it('round-trips through the route a row links to', () => {
    const href = routes.notifications({
      entity: { type: NotificationEntityType.DEVICE, id: 'm-1', name: 'RECEPTION' },
    });
    expect(href).toBe('/notifications?entityType=DEVICE&entityId=m-1&entityName=RECEPTION');
    const params = new URLSearchParams(href.split('?')[1]);
    expect(parseNotificationEntityScope(params.get('entityType') ?? '', params.get('entityId') ?? '')).toEqual(DEVICE);
  });

  it('is labelled by kind, and by name when the link carried one', () => {
    expect(entityScopeLabel(NotificationEntityType.DEVICE, 'RECEPTION')).toBe('Device: RECEPTION');
    expect(entityScopeLabel(NotificationEntityType.INSIGHT, '')).toBe('Incident');
  });
});

const CATEGORY = 'DEVICES';
const SCOPED_PAIR: NotificationConnectionPair = {
  unread: notificationsConnectionFilters(false, '', DEVICE),
  read: notificationsConnectionFilters(true, '', DEVICE),
};
const PAIRS = [SCOPED_PAIR, UNFILTERED_NOTIFICATION_PAIR];

function update(environment: Environment, updater: (store: RecordSourceSelectorProxy) => void): void {
  commitLocalUpdate(environment, updater);
}

function seedUnread(store: RecordSourceSelectorProxy, id: string, lists: NotificationsConnectionFilters[]): void {
  const node = store.get(id) ?? store.create(id, 'Notification');
  node.setValue(id, 'id');
  node.setValue(CATEGORY, 'category');
  node.setValue('2026-11-03T00:00:00Z', 'createdAt');
  setReadStatus(node, NotificationReadStatus.UNREAD);
  for (const filters of lists) {
    const conn = ConnectionHandler.getConnection(store.getRoot(), NOTIFICATIONS_CONNECTION_KEY, filters);
    if (!conn) throw new Error('connection not seeded');
    ConnectionHandler.insertEdgeBefore(conn, ConnectionHandler.createEdge(store, conn, node, 'NotificationEdge'));
  }
}

function unreadBucket(environment: Environment): number {
  let count = -1;
  update(environment, store => {
    const bucket = (store.getRoot().getLinkedRecords('unreadCountsByCategory') ?? [])[0];
    count = Number(bucket?.getValue('count'));
  });
  return count;
}

function hasNextPage(environment: Environment, filters: NotificationsConnectionFilters): unknown {
  let value: unknown;
  update(environment, store => {
    const conn = ConnectionHandler.getConnection(store.getRoot(), NOTIFICATIONS_CONNECTION_KEY, filters);
    value = conn?.getLinkedRecord('pageInfo')?.getValue('hasNextPage');
  });
  return value;
}

describe('Mark All Complete on one entity', () => {
  let environment: Environment;

  beforeEach(() => {
    environment = makeOfflineEnvironment();
    update(environment, store => {
      for (const pair of PAIRS) {
        createConnection(store, pair.unread);
        createConnection(store, pair.read);
      }
      const bucket = store.create(`client:UnreadCategoryCount:${CATEGORY}`, 'UnreadCategoryCount');
      bucket.setValue(CATEGORY, 'category');
      bucket.setValue(3, 'count');
      store.getRoot().setLinkedRecords([bucket], 'unreadCountsByCategory');
      // n-1 and n-2 are about the device, n-3 about another one: only the drawer holds it.
      seedUnread(store, 'n-1', [SCOPED_PAIR.unread, UNFILTERED_NOTIFICATION_PAIR.unread]);
      seedUnread(store, 'n-2', [SCOPED_PAIR.unread, UNFILTERED_NOTIFICATION_PAIR.unread]);
      seedUnread(store, 'n-3', [UNFILTERED_NOTIFICATION_PAIR.unread]);
      const scoped = ConnectionHandler.getConnection(store.getRoot(), NOTIFICATIONS_CONNECTION_KEY, SCOPED_PAIR.unread);
      scoped?.getLinkedRecord('pageInfo')?.setValue(true, 'hasNextPage');
    });
  });

  it("moves the entity's loaded notifications to history in every list, and nothing else", () => {
    update(environment, makeMarkEntityReadUpdater(DEVICE, PAIRS));

    expect(nodeIds(environment, SCOPED_PAIR.unread)).toEqual([]);
    expect(nodeIds(environment, SCOPED_PAIR.read).sort()).toEqual(['n-1', 'n-2']);
    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.unread)).toEqual(['n-3']);
    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.read).sort()).toEqual(['n-1', 'n-2']);
    expect(unreadBucket(environment)).toBe(1);
  });

  it('closes the scoped list: its pages not loaded yet were read too', () => {
    update(environment, makeMarkEntityReadUpdater(DEVICE, PAIRS));
    expect(hasNextPage(environment, SCOPED_PAIR.unread)).toBe(false);
  });

  it('is a no-op the second time, the optimistic pass then the server one', () => {
    update(environment, makeMarkEntityReadUpdater(DEVICE, PAIRS));
    update(environment, makeMarkEntityReadUpdater(DEVICE, PAIRS));
    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.read).sort()).toEqual(['n-1', 'n-2']);
    expect(unreadBucket(environment)).toBe(1);
  });

  it('touches no list when another entity is asked for', () => {
    update(environment, makeMarkEntityReadUpdater({ type: NotificationEntityType.DEVICE, id: 'm-2' }, PAIRS));
    expect(nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.unread).sort()).toEqual(['n-1', 'n-2', 'n-3']);
    expect(unreadBucket(environment)).toBe(3);
  });
});
