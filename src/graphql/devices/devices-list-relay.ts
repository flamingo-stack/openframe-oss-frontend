import { graphql } from 'react-relay';

/**
 * The scrolled device list — the Devices page, the customer devices tab and the
 * archive page.
 *
 * A `@refetchable` fragment with `@connection`, so Relay owns the cursors and
 * page merging that the previous `useInfiniteQuery` did by hand.
 *
 * `filters: ["filter", "search"]` on the connection is required, not cosmetic:
 * without it every filter/search combination would write into ONE connection
 * record and the pages of a filtered list would append to the unfiltered one.
 * With it, each combination gets its own connection, which is the behaviour the
 * react-query key `[filter, search]` used to provide.
 *
 * Ordering is fixed to `status DESC` (online first) here rather than passed by
 * callers, so two screens showing the same fleet cannot disagree about its order.
 */
export const devicesListRelayQuery = graphql`
  query devicesListRelayQuery($filter: DeviceFilterInput, $search: String, $first: Int!, $after: String) {
    ...devicesListRelay_query @arguments(filter: $filter, search: $search, first: $first, after: $after)
  }
`;

export const devicesListRelayFragment = graphql`
  fragment devicesListRelay_query on Query
  @refetchable(queryName: "devicesListRelayPaginationQuery")
  @argumentDefinitions(
    filter: { type: "DeviceFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    devices(
      filter: $filter
      search: $search
      first: $first
      after: $after
      sort: { field: "status", direction: DESC }
    ) @connection(key: "devicesListRelay_devices", filters: ["filter", "search"]) {
      filteredCount
      edges {
        node {
          ...deviceFields_machine
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
