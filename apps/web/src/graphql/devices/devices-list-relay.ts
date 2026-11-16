import { graphql } from 'react-relay';

/**
 * The scrolled device list — the Devices page, the customer devices tab and the
 * archive page.
 *
 * A `@refetchable` fragment with `@connection`, so Relay owns the cursors and
 * page merging that the previous `useInfiniteQuery` did by hand.
 *
 * `filters: ["filter", "search", "sort"]` on the connection is required, not cosmetic:
 * without it every filter/search/sort combination would write into ONE connection
 * record and the pages of a filtered list would append to the unfiltered one.
 * With it, each combination gets its own connection, which is the behaviour the
 * react-query key `[filter, search]` used to provide.
 *
 * Ordering is `status DESC` (online first) unless the address asks for outdated
 * clients first (`?sort=clientOutdated`, see `parseDeviceListSort`); `sort` is in the
 * connection's `filters` so the two orders never share one connection record.
 *
 * `unreadNotificationCount` and `clientOutdated` are selected beside the shared fragment,
 * not in it: only this list draws a row's unread count and OUTDATED tag, and the pickers
 * on the same fragment should not pay for them. `deviceDirectoryFields_machine` sits beside it for a harder reason: its fields exist only in the
 * `tenant-management-v2` schema, so this list runs only while that flag is on, and off the panel reads
 * `devicesListRelayV1_query`, which selects neither.
 */
export const devicesListRelayQuery = graphql`
  query devicesListRelayQuery(
    $filter: DeviceFilterInput
    $search: String
    $first: Int!
    $after: String
    $sort: SortInput!
  ) {
    ...devicesListRelay_query @arguments(filter: $filter, search: $search, first: $first, after: $after, sort: $sort)
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
    sort: { type: "SortInput!" }
  ) {
    devices(filter: $filter, search: $search, first: $first, after: $after, sort: $sort)
      @connection(key: "devicesListRelay_devices", filters: ["filter", "search", "sort"]) {
      filteredCount
      edges {
        node {
          ...deviceFields_machine
          ...deviceDirectoryFields_machine
          unreadNotificationCount
          clientOutdated
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
