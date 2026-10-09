import { graphql } from 'react-relay';

/**
 * The tenant's remote sessions on every device (the Devices page's Remote
 * Sessions tab). One `remoteSessions` connection, filtered and sorted on the
 * server: devices, customer, recording state and the session-date range travel
 * in `filter`, the date order in `sort`. A cursor is only valid under the sort
 * it was issued for, so a changed filter or sort starts again without `after` -
 * a new variables set is a new connection record, which does exactly that.
 *
 * Each row spreads the session selection the device tab and the recording page
 * read (`sessionRecordingsApiService_session`), plus the device it ran on.
 */
export const tenantRemoteSessionsRelayQuery = graphql`
  query tenantRemoteSessionsRelayQuery(
    $filter: RemoteSessionFilter
    $sort: RemoteSessionSort
    $first: Int!
    $after: String
  ) {
    ...tenantRemoteSessionsRelay_query @arguments(filter: $filter, sort: $sort, first: $first, after: $after)
  }
`;

export const tenantRemoteSessionsRelayFragment = graphql`
  fragment tenantRemoteSessionsRelay_query on Query
  @refetchable(queryName: "tenantRemoteSessionsRelayPaginationQuery")
  @argumentDefinitions(
    filter: { type: "RemoteSessionFilter" }
    sort: { type: "RemoteSessionSort" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    remoteSessions(filter: $filter, sort: $sort, first: $first, after: $after)
      @connection(key: "tenantRemoteSessionsRelay_remoteSessions", filters: ["filter", "sort"]) {
      totalCount
      edges {
        node {
          ...sessionRecordingsApiService_session
          device {
            machineId
            displayName
            hostname
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
