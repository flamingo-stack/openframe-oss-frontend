import { fetchQuery, graphql } from 'react-relay';
import type { IEnvironment } from 'relay-runtime';
import type { notificationsDrawerRelayQuery as NotificationsDrawerRelayQueryType } from '@/__generated__/notificationsDrawerRelayQuery.graphql';

/** First page size — keep in sync with the fragment's `first` default below. */
export const DRAWER_PAGE_SIZE = 30;

export const notificationsDrawerRelayQuery = graphql`
  query notificationsDrawerRelayQuery($first: Int!, $after: String) {
    ...notificationsDrawerRelay_query @arguments(first: $first, after: $after)
  }
`;

export const notificationsDrawerRelayFragment = graphql`
  fragment notificationsDrawerRelay_query on Query
  @refetchable(queryName: "notificationsDrawerRelayPaginationQuery")
  @argumentDefinitions(first: { type: "Int", defaultValue: 30 }, after: { type: "String" }) {
    notifications(first: $first, after: $after, filter: { read: false }, search: null)
      @connection(key: "NotificationsList_notifications", filters: ["filter", "search"]) {
      edges {
        cursor
        node {
          # The shared row selection (notification-fields.ts) — identical to the
          # section list's, so both read the same rows out of the same store.
          ...notificationFields_notification
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const DRAWER_REFETCH_MIN_INTERVAL_MS = 3_000;
let drawerRefetchAt = 0;

/**
 * Re-fetch the drawer's first page into the Relay store (a cursor-less fetch
 * replaces the connection's edges). Closes live-push gaps: a push that arrived
 * before the connection existed, or anything published while NATS was down.
 * Throttled so a burst costs one request; failures keep the previous rows.
 */
export function refetchNotificationsDrawer(environment: IEnvironment): void {
  const now = Date.now();
  if (now - drawerRefetchAt < DRAWER_REFETCH_MIN_INTERVAL_MS) return;
  drawerRefetchAt = now;
  fetchQuery<NotificationsDrawerRelayQueryType>(
    environment,
    notificationsDrawerRelayQuery,
    { first: DRAWER_PAGE_SIZE, after: null },
    { fetchPolicy: 'network-only' },
  ).subscribe({
    error: () => {},
  });
}
