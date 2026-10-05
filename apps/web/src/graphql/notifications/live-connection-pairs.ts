import { type NotificationConnectionPair, UNFILTERED_NOTIFICATION_PAIR } from './notifications-helpers';

/**
 * The connection pairs a live READ / DELETED event has to reach.
 *
 * The drawer reads the unfiltered pair, which the live bridge knows by name. The
 * `/notifications` page keys its connections by the search string as well, and Relay
 * offers no way to enumerate the connections behind one `@connection` key — so a mounted
 * list registers the pairs it reads, and the bridge flips read-state into every one of
 * them instead of only the drawer's. Unregistered stale pairs (an earlier search string)
 * are not a concern: their query is disposed, and the next load of that search is
 * `network-only`, which replaces the edges wholesale.
 */
const registered = new Set<readonly NotificationConnectionPair[]>();

export function registerLiveConnectionPairs(pairs: readonly NotificationConnectionPair[]): () => void {
  registered.add(pairs);
  return () => {
    registered.delete(pairs);
  };
}

/** Every registered pair, the unfiltered one first. Duplicates are fine — the updaters dedupe by connection. */
export function getLiveConnectionPairs(): NotificationConnectionPair[] {
  const pairs: NotificationConnectionPair[] = [UNFILTERED_NOTIFICATION_PAIR];
  for (const list of registered) pairs.push(...list);
  return pairs;
}

/**
 * History lists that render a row's read status and have to re-read it from the server.
 *
 * The backend relays an entity's ARCHIVED transition over NATS as a plain READ event, so a
 * READ for a row not already READ here could be either a read elsewhere or an archive — and
 * only the server knows which. Archiving moves only UNREAD rows, so a READ for a row already
 * READ is never one. Drop this once the event carries the status.
 */
const readStatusRefreshListeners = new Set<() => void>();

export function subscribeReadStatusRefresh(listener: () => void): () => void {
  readStatusRefreshListeners.add(listener);
  return () => {
    readStatusRefreshListeners.delete(listener);
  };
}

export function requestReadStatusRefresh(): void {
  for (const listener of readStatusRefreshListeners) listener();
}
