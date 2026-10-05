import { graphql } from 'react-relay';

/**
 * A single bounded page of devices, for the surfaces that PICK from the fleet
 * rather than browse it: the run/test-script device pickers, the schedule assign
 * view, the ticket-form device autocomplete.
 *
 * Deliberately not a `@connection` — a Relay connection exists so a component
 * can append pages into a store-managed list, and neither caller wants that.
 * The pickers take a cap and render what fits; `fetchAllDevices` walks `$after`
 * itself to build a lookup table it hands to plain code. `pageInfo` is here for
 * that walk, and the pickers ignore it.
 *
 * Same `deviceFields_machine` fragment and same `status DESC` ordering as the
 * scrolled list, so a picker shows the same fleet, in the same order, as the
 * Devices page — and Relay normalizes both into the same `Machine` records.
 */
export const devicesPageRelayQuery = graphql`
  query devicesPageRelayQuery($filter: DeviceFilterInput, $search: String, $first: Int!, $after: String) {
    devices(
      filter: $filter
      search: $search
      first: $first
      after: $after
      sort: { field: "status", direction: DESC }
    ) {
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
