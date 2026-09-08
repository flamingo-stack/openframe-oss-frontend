import { graphql } from 'react-relay';

/**
 * The machines assigned to a schedule — split out of
 * `scriptScheduleDetailRelayQuery` because the per-machine resolution is the
 * schedule's slowest field (observed 504 via the LB on test-dev), so only the
 * Assigned Devices tab and the Edit Devices page mount it.
 *
 * The selection is dictated by `DevicesTableBody` — the tab renders the same
 * table as the Devices page, so it needs the same per-row fields that page's
 * `deviceFields_machine` feeds it.
 *
 * `organization` IS selected here, deliberately and with a known cost: it fans
 * out one lookup per machine, on top of a field that has already timed out once
 * on test-dev. CUSTOMER is a column of that shared table, so the tab cannot
 * render without it. If this page starts timing out, this selection is the
 * first suspect — the fix is a batched org resolver on the backend, not
 * dropping the column again.
 *
 * `assignedDevices` is a Relay connection (same filter/search/sort/pagination
 * as the top-level `devices` query, scoped to this schedule's assignments), so
 * the tab paginates instead of pulling the whole assignment at once.
 */
export const scriptScheduleDevicesRelayQuery = graphql`
  query scriptScheduleDevicesRelayQuery(
    $id: ID!
    $first: Int!
    $after: String
    $filter: DeviceFilterInput
    $search: String
  ) {
    scriptSchedule(id: $id) {
      id
      deviceCount
      ...scriptScheduleDevicesRelay_schedule @arguments(first: $first, after: $after, filter: $filter, search: $search)
    }
  }
`;

export const scriptScheduleDevicesRelayFragment = graphql`
  fragment scriptScheduleDevicesRelay_schedule on ScriptSchedule
  @refetchable(queryName: "scriptScheduleDevicesRelayPaginationQuery")
  @argumentDefinitions(
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
    filter: { type: "DeviceFilterInput" }
    search: { type: "String" }
  ) {
    # The connection declares its filters: narrowing is part of the connection's
    # IDENTITY, so each filter/search combination gets its own record instead of
    # appending a filtered page onto the unfiltered one already in the store.
    assignedDevices(first: $first, after: $after, filter: $filter, search: $search)
      @connection(key: "scriptScheduleDevicesRelay_assignedDevices", filters: ["filter", "search"]) {
      filteredCount
      edges {
        node {
          # The narrowest step of the device field ladder (device-row-fields.ts)
          # — a table row and nothing more, which is the whole point here: it
          # carries the CUSTOMER column's per-machine fan-out the docstring
          # warns about and stops before the heavier steps above it.
          ...deviceRowFields_machine
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
