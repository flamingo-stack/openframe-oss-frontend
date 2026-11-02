/**
 * The notification connections as a real relay-runtime store holds them, for the suites that
 * pin what ends up in the store rather than calls to a mock of it.
 */
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
import { NOTIFICATIONS_CONNECTION_KEY, type NotificationsConnectionFilters } from '../notifications-helpers';

export function makeOfflineEnvironment(): Environment {
  return new Environment({
    network: Network.create(() => Promise.reject(new Error('no network in this test'))),
    store: new Store(new RecordSource()),
  });
}

/** Materialise an empty connection under the root, the way a query response would. */
export function createConnection(store: RecordSourceSelectorProxy, filters: NotificationsConnectionFilters): void {
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

export function nodeIds(environment: Environment, filters: NotificationsConnectionFilters): string[] {
  let ids: string[] = [];
  commitLocalUpdate(environment, store => {
    const conn = ConnectionHandler.getConnection(store.getRoot(), NOTIFICATIONS_CONNECTION_KEY, filters);
    ids = (conn?.getLinkedRecords('edges') ?? []).flatMap(edge => edge?.getLinkedRecord('node')?.getDataID() ?? []);
  });
  return ids;
}
