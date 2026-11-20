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
 * `assignedDevices` takes the same filter/search/sort/pagination as the
 * top-level `devices` query, scoped to this schedule's assignments. One page
 * per request, its cursor in the URL (`deviceCursor`): no `@connection`, so a
 * cursor from a link reads exactly its page. Forward only: the API answers
 * `before` with the NEXT page, so the query takes `first` / `after` and never
 * `last` / `before`.
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
      assignedDevices(first: $first, after: $after, filter: $filter, search: $search) {
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
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  }
`;
