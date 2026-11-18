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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The one read a click or a shell's tap commits, pinned against a real relay-runtime store:
 * the shells' tests mock this module, so this is where their read is shown to reach the
 * server by the notification's Relay id and to leave every list it shows in agreeing.
 */

const h = vi.hoisted(() => ({
  environment: null as unknown as Environment,
  sent: [] as { name: string; variables: Record<string, unknown> }[],
  answer: null as ((ok: boolean) => void) | null,
  refreshCounts: vi.fn(),
}));

// `graphql` tags are compiled away by the relay babel transform, which vitest doesn't run, so each
// tag resolves to the artifact relay-compiler generated for it. react-relay is CJS, so its named
// exports sit under `default` too.
vi.mock('react-relay', async importOriginal => {
  const actual = await importOriginal<typeof ReactRelay & { default?: typeof ReactRelay }>();
  const artifacts = import.meta.glob<{ default: unknown }>('/src/__generated__/*.graphql.ts');
  const loaded = new Map(
    await Promise.all(Object.entries(artifacts).map(async ([path, load]) => [path, (await load()).default] as const)),
  );
  return {
    ...actual,
    ...actual.default,
    graphql: (text: TemplateStringsArray) => {
      const name = /(?:query|mutation|fragment)\s+(\w+)/.exec(text.join(''))?.[1];
      return loaded.get(`/src/__generated__/${name}.graphql.ts`);
    },
  };
});
vi.mock('@/lib/relay/environment', () => ({ getRelayEnvironment: () => h.environment }));
vi.mock('./unread-counts-relay', () => ({ refreshUnreadCounts: h.refreshCounts }));

import { NotificationReadStatus } from '@/generated/schema-enums';
import { notificationGlobalId } from '@/lib/relay-id';
import { createConnection } from './__tests__/store-fixtures';
import { registerLiveConnectionPairs } from './live-connection-pairs';
import { commitMarkNotificationRead, markNotificationReadById } from './mark-notification-read-mutation';
import {
  type NotificationConnectionPair,
  NOTIFICATIONS_CONNECTION_KEY,
  notificationsConnectionFilters,
  type NotificationsConnectionFilters,
  setReadStatus,
  UNFILTERED_NOTIFICATION_PAIR,
} from './notifications-helpers';

const RAW_ID = '6729a1f0c3b4d5e6f7a8b912';
const ID = notificationGlobalId(RAW_ID);
const CATEGORY = 'GENERIC';
/** The `/notifications` page's lists for a search: what a live list beside the drawer looks like. */
const SEARCH_PAIR: NotificationConnectionPair = {
  unread: notificationsConnectionFilters(false, 'release'),
  read: notificationsConnectionFilters(true, 'release'),
};

/** The server's answer to the mark-read mutation waits for the test, so the read before it can be seen. */
function makeEnvironment(): Environment {
  return new Environment({
    network: Network.create((params, variables) => {
      h.sent.push({ name: params.name, variables });
      return new Promise((resolve, reject) => {
        h.answer = ok => (ok ? resolve({ data: { markNotificationAsRead: true } }) : reject(new Error('refused')));
      });
    }),
    store: new Store(new RecordSource()),
  });
}

function update(updater: (store: RecordSourceSelectorProxy) => void): void {
  commitLocalUpdate(h.environment, updater);
}

function seedUnread(lists: NotificationsConnectionFilters[]): void {
  update(store => {
    const bucket = store.create(`client:UnreadCategoryCount:${CATEGORY}`, 'UnreadCategoryCount');
    bucket.setValue(CATEGORY, 'category');
    bucket.setValue(2, 'count');
    store.getRoot().setLinkedRecords([bucket], 'unreadCountsByCategory');
    const node = store.create(ID, 'Notification');
    node.setValue(ID, 'id');
    node.setValue(CATEGORY, 'category');
    setReadStatus(node, NotificationReadStatus.UNREAD);
    for (const filters of lists) {
      createConnection(store, filters);
      const conn = ConnectionHandler.getConnection(store.getRoot(), NOTIFICATIONS_CONNECTION_KEY, filters);
      if (!conn) throw new Error('connection not seeded');
      ConnectionHandler.insertEdgeBefore(conn, ConnectionHandler.createEdge(store, conn, node, 'NotificationEdge'));
    }
  });
}

/**
 * What the store shows now, its optimistic layer included. Read from the source rather than
 * through `commitLocalUpdate`, whose updater sees the store with optimistic updates set aside.
 */
const visible = () => h.environment.getStore().getSource();

function readState(): { status: unknown; unreadCount: unknown } {
  const node = visible().get(ID);
  return {
    status: node?.status,
    unreadCount: visible().get(`client:UnreadCategoryCount:${CATEGORY}`)?.count,
  };
}

/** The notification ids a list shows; its record is the one `createConnection` made. */
function listed(filters: NotificationsConnectionFilters): string[] {
  const handleKey = getRelayHandleKey('connection', NOTIFICATIONS_CONNECTION_KEY, null);
  const edges = visible().get(`client:root:${handleKey}:${JSON.stringify(filters)}`)?.edges as
    { __refs?: string[] } | undefined;
  return (edges?.__refs ?? []).flatMap(
    edge => (visible().get(edge)?.node as { __ref?: string } | undefined)?.__ref ?? [],
  );
}

/** Lets the network's promise settle and Relay publish what follows from it. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

let unregister: () => void = () => {};

beforeEach(() => {
  h.environment = makeEnvironment();
  h.sent = [];
  h.answer = null;
  h.refreshCounts.mockReset();
});

afterEach(() => {
  unregister();
  vi.restoreAllMocks();
});

describe('markNotificationReadById', () => {
  it('reads the tapped notification by its Relay id, in the drawer and every mounted list, at once', async () => {
    seedUnread([UNFILTERED_NOTIFICATION_PAIR.unread, SEARCH_PAIR.unread]);
    unregister = registerLiveConnectionPairs([SEARCH_PAIR]);

    markNotificationReadById(RAW_ID);

    expect(h.sent).toEqual([{ name: 'markNotificationReadMutation', variables: { id: ID } }]);
    // Before the server answers: the tap has to show as read already.
    expect(readState()).toEqual({ status: NotificationReadStatus.READ, unreadCount: 1 });
    expect(listed(UNFILTERED_NOTIFICATION_PAIR.unread)).toEqual([]);
    expect(listed(SEARCH_PAIR.unread)).toEqual([]);

    h.answer?.(true);
    await flush();

    expect(readState()).toEqual({ status: NotificationReadStatus.READ, unreadCount: 1 });
    expect(listed(SEARCH_PAIR.unread)).toEqual([]);
    expect(h.refreshCounts).toHaveBeenCalledWith(h.environment);
  });

  it('puts the notification back, and only warns, when the server refuses the read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    seedUnread([UNFILTERED_NOTIFICATION_PAIR.unread]);

    markNotificationReadById(RAW_ID);
    h.answer?.(false);
    await flush();

    expect(readState()).toEqual({ status: NotificationReadStatus.UNREAD, unreadCount: 2 });
    expect(listed(UNFILTERED_NOTIFICATION_PAIR.unread)).toEqual([ID]);
    expect(warn).toHaveBeenCalledWith('[Notifications] mark-read on a shell tap failed:', RAW_ID, expect.any(Error));
    expect(h.refreshCounts).not.toHaveBeenCalled();
  });
});

describe('commitMarkNotificationRead', () => {
  // A list mounted while the read is in flight is reached by the server's update too, as the
  // hook's own commit always did by reading its pairs through a ref.
  it('reads its lists when the store update runs, not when the read is committed', async () => {
    seedUnread([UNFILTERED_NOTIFICATION_PAIR.unread, SEARCH_PAIR.unread]);
    let pairs: NotificationConnectionPair[] = [UNFILTERED_NOTIFICATION_PAIR];
    const onError = vi.fn();

    commitMarkNotificationRead(h.environment, ID, { pairs: () => pairs, onError });
    expect(listed(SEARCH_PAIR.unread)).toEqual([ID]);

    pairs = [UNFILTERED_NOTIFICATION_PAIR, SEARCH_PAIR];
    h.answer?.(true);
    await flush();

    expect(listed(SEARCH_PAIR.unread)).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("hands the server's refusal to the caller", async () => {
    seedUnread([UNFILTERED_NOTIFICATION_PAIR.unread]);
    const onError = vi.fn();

    commitMarkNotificationRead(h.environment, ID, { pairs: () => [UNFILTERED_NOTIFICATION_PAIR], onError });
    h.answer?.(false);
    await flush();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(readState().status).toBe(NotificationReadStatus.UNREAD);
  });
});
