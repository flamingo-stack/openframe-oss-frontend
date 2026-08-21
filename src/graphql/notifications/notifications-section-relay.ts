import { graphql } from 'react-relay';

export const notificationsSectionRelayQuery = graphql`
  query notificationsSectionRelayQuery(
    $first: Int!
    $after: String
    $filter: NotificationFilterInput
    $search: String
  ) {
    ...notificationsSectionRelay_query
      @arguments(first: $first, after: $after, filter: $filter, search: $search)
  }
`;

export const notificationsSectionRelayFragment = graphql`
  fragment notificationsSectionRelay_query on Query
    @refetchable(queryName: "notificationsSectionRelayPaginationQuery")
    @argumentDefinitions(
      first: { type: "Int", defaultValue: 50 }
      after: { type: "String" }
      filter: { type: "NotificationFilterInput" }
      search: { type: "String" }
    ) {
    notifications(first: $first, after: $after, filter: $filter, search: $search)
      @connection(key: "NotificationsList_notifications", filters: ["filter", "search"]) {
      edges {
        cursor
        node {
          # The shared row selection (notification-fields.ts) — identical to the
          # drawer's, so both read the same rows out of the same store.
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
