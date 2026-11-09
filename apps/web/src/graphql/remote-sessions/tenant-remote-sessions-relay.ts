import { graphql } from 'react-relay';

/**
 * One row of the tenant-wide list: the session selection the device tab and the
 * recording page read (`sessionRecordingsApiService_session`), plus the device
 * it ran on and that device's customer, whose image is the CUSTOMER column's
 * logo. Shared by the paged list and the running-sessions poll, so a row reads
 * the same from either.
 */
export const tenantRemoteSessionsRelayRowFragment = graphql`
  fragment tenantRemoteSessionsRelay_row on RemoteSession @inline {
    ...sessionRecordingsApiService_session
    device {
      machineId
      displayName
      hostname
      ...sessionRecordingsApiService_deviceCustomer
    }
  }
`;

/**
 * The tenant's remote sessions on every device (the Devices page's Remote
 * Sessions tab). One `remoteSessions` connection, filtered and sorted on the
 * server: devices, customer, recording state and the session-date range travel
 * in `filter`, the date order in `sort`. A cursor is only valid under the sort
 * it was issued for, so a changed filter or sort starts again without `after` -
 * a new variables set is a new connection record, which does exactly that.
 *
 * The first page starts with the running sessions (at most 100, newest first
 * under every sort, extra to `first`); later pages never hold one.
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
          ...tenantRemoteSessionsRelay_row
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * The running sessions alone, polled to keep the list's LIVE rows current: the
 * list's filter with `recordingState: LIVE`, in the order the first page shows
 * them. Under LIVE the answer is the ACTIVE block only (at most 100, extra to
 * `first`, never paged; see `remoteSessions` in the schema), so no `first` is
 * passed: it would bound nothing.
 */
export const tenantRemoteSessionsRelayLiveQuery = graphql`
  query tenantRemoteSessionsRelayLiveQuery($filter: RemoteSessionFilter!) {
    remoteSessions(filter: $filter) {
      edges {
        node {
          ...tenantRemoteSessionsRelay_row
        }
      }
    }
  }
`;
