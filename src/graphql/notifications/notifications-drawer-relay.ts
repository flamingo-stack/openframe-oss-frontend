import { graphql } from 'react-relay';

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
