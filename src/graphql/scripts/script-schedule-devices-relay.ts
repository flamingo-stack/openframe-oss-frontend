import { graphql } from 'react-relay';

/**
 * The machines assigned to a schedule — split out of
 * `scriptScheduleDetailRelayQuery` because the per-machine resolution is the
 * schedule's slowest field (observed 504 via the LB on test-dev), so only the
 * Assigned Devices tab and the Edit Devices page mount it.
 *
 * The selection is dictated by `DevicesTableBody` — the tab renders the same
 * table as the Devices page, so it needs the same per-row fields that page's
 * `GET_DEVICES_QUERY` feeds it.
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
  query scriptScheduleDevicesRelayQuery($id: ID!, $first: Int!, $after: String) {
    scriptSchedule(id: $id) {
      id
      deviceCount
      ...scriptScheduleDevicesRelay_schedule @arguments(first: $first, after: $after)
    }
  }
`;

export const scriptScheduleDevicesRelayFragment = graphql`
  fragment scriptScheduleDevicesRelay_schedule on ScriptSchedule
    @refetchable(queryName: "scriptScheduleDevicesRelayPaginationQuery")
    @argumentDefinitions(first: { type: "Int", defaultValue: 20 }, after: { type: "String" }) {
    assignedDevices(first: $first, after: $after) @connection(key: "scriptScheduleDevicesRelay_assignedDevices") {
      filteredCount
      edges {
        node {
          id
          machineId
          hostname
          displayName
          osType
          status
          # type picks the DEVICE column's row icon; lastSeen is the line
          # under the status tag.
          lastSeen
          type
          # The CUSTOMER column: logo + name. This is the per-machine fan-out
          # the docstring warns about.
          organization {
            id
            organizationId
            name
            image {
              imageUrl
              hash
            }
          }
          # Feeds the "Device Tags" filter, which narrows client-side over the
          # pages loaded so far. Plain field on the machine — no extra lookup.
          tags {
            id
            key
            values
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

/**
 * The same assignment, flattened to the two id fields "Edit Devices" needs to
 * seed its selection (`machineId` key → Machine global id for the mutation).
 * Deliberately NOT the paginated fragment: a partially loaded selection would
 * let Save drop the unseen tail, so this reads the whole assignment in one
 * page — matching the candidate list, which is itself capped at 100 devices
 * (`use-run-devices`).
 */
export const scriptScheduleDevicesRelayIdsQuery = graphql`
  query scriptScheduleDevicesRelayIdsQuery($id: ID!, $first: Int!) {
    scriptSchedule(id: $id) {
      id
      deviceCount
      assignedDevices(first: $first) {
        edges {
          node {
            id
            machineId
          }
        }
      }
    }
  }
`;
