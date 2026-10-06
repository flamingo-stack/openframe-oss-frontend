import { type NotificationConnectionPair, UNFILTERED_NOTIFICATION_PAIR } from './notifications-helpers';

/**
 * The connection pairs a live read-state event has to reach.
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
 * oss-lib 6.37.31+ (#2466) relays an entity's archive as an ARCHIVED event, which the store
 * applies directly. A refresh is requested only when the store can't settle a status itself:
 * - an ARCHIVED for an id that was never loaded, so there is no card to flag;
 * - from older backends, which relay the archive as a plain READ, a READ for a row not already
 *   READ here — a read elsewhere and an archive look the same, and only the server knows which.
 *   Archiving moves only UNREAD rows, so a READ for a row already READ is never an archive.
 *   Drop this case once every environment runs 6.37.31+.
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
