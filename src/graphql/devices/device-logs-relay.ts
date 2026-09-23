import { graphql } from 'react-relay';

/** The API maximum; scroll pages ask for it so a busy device needs fewer round trips. */
export const DEVICE_LOGS_PAGE_SIZE = 500;
/** A poll only ever carries a minute's worth of lines (the agent batches 50 per 60 s). */
export const DEVICE_LOGS_POLL_SIZE = 100;

export const deviceLogsRelayQuery = graphql`
  query deviceLogsRelayQuery($machineId: String!, $filter: DeviceLogFilterInput, $first: Int!, $after: String) {
    ...deviceLogsRelay_query @arguments(machineId: $machineId, filter: $filter, first: $first, after: $after)
  }
`;

// `filters` keys the connection on the machine AND the filter: cursors belong to
// the filter that produced them, so a filter change must start a new list
// instead of appending to the old one.
export const deviceLogsRelayFragment = graphql`
  fragment deviceLogsRelay_query on Query
  @refetchable(queryName: "deviceLogsRelayPaginationQuery")
  @argumentDefinitions(
    machineId: { type: "String!" }
    filter: { type: "DeviceLogFilterInput" }
    first: { type: "Int", defaultValue: 500 }
    after: { type: "String" }
  ) {
    deviceLogs(machineId: $machineId, filter: $filter, first: $first, after: $after)
      @connection(key: "deviceLogsRelay_deviceLogs", filters: ["machineId", "filter"]) {
      edges {
        cursor
        node {
          ...deviceLogFields_entry
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
 * The auto-update probe: same selection, no connection. It is fetched
 * imperatively with `from` = the newest line on screen, and its lines are
 * prepended by the live-tail hook rather than merged into the store.
 */
export const deviceLogsRelayPollQuery = graphql`
  query deviceLogsRelayPollQuery($machineId: String!, $filter: DeviceLogFilterInput, $first: Int!, $after: String) {
    deviceLogs(machineId: $machineId, filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          ...deviceLogFields_entry
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
