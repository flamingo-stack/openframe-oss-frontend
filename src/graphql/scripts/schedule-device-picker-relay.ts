import { graphql } from 'react-relay';

/**
 * The "Available Devices" half of the schedule device picker.
 *
 * `availableDevices` hangs off the schedule rather than the root — it is the
 * schedule that scopes it, to that schedule's `supportedPlatforms`, so a
 * platform-mismatched device is never offered. The old page pulled the generic
 * `devices` list and narrowed it in the browser, which only worked for as long
 * as the whole fleet fit in the one page it fetched.
 *
 * Search, filters and paging all live on the server, so what the user sees IS
 * the full candidate set rather than the first page of it. That is what makes
 * "Add All Devices" honest: the same `filter`/`search` go to
 * `addAllDevicesToSchedule`, which resolves the set itself.
 *
 * `assigned` is selected on the EDGE, not the node — it is a fact about this
 * device's relationship to THIS schedule, not about the machine, and the
 * connection type (`AvailableDeviceConnection`) exists to carry it. It settles
 * what the old contract left open: the list does NOT exclude devices that are
 * already assigned, it marks them, so the picker pre-checks those rows instead
 * of offering to add what is already in.
 */
export const scheduleDevicePickerRelayQuery = graphql`
  query scheduleDevicePickerRelayQuery(
    $scheduleId: ID!
    $filter: DeviceFilterInput
    $search: String
    $first: Int!
    $after: String
  ) {
    scriptSchedule(id: $scheduleId) {
      id
      ...scheduleDevicePickerRelay_available
        @arguments(filter: $filter, search: $search, first: $first, after: $after)
    }
  }
`;

export const scheduleDevicePickerRelayFragment = graphql`
  fragment scheduleDevicePickerRelay_available on ScriptSchedule
    @refetchable(queryName: "scheduleDevicePickerRelayPaginationQuery")
    @argumentDefinitions(
      filter: { type: "DeviceFilterInput" }
      search: { type: "String" }
      first: { type: "Int", defaultValue: 20 }
      after: { type: "String" }
    ) {
    availableDevices(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "scheduleDevicePickerRelay_availableDevices") {
      filteredCount
      edges {
        assigned
        node {
          id
          machineId
          hostname
          displayName
          osType
          status
          lastSeen
          type
          manufacturer
          model
          serialNumber
          organization {
            id
            organizationId
            name
            image {
              imageUrl
              hash
            }
            contactInformation {
              contacts {
                email
              }
            }
          }
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
 * The "Selected Devices" half — the schedule's current assignment, with the
 * picker's own search and filters applied server-side.
 *
 * A second connection over `assignedDevices` next to the one in
 * `script-schedule-devices-relay.ts` on purpose: that one backs the read-only
 * tab on the details page and is narrowed by that page's controls, this one is
 * narrowed by the picker's. Separate `@connection` keys keep the two lists from
 * overwriting each other's pages in the store.
 *
 * `deviceCount` sits on the schedule rather than inside the connection because
 * it is what the "Selected Devices (N)" tab label counts: the WHOLE assignment,
 * which does not shrink because the user typed in the search box. The
 * connection's own `filteredCount` answers a different question — how many rows
 * the current narrowing leaves — and is what the list itself reports.
 */
export const scheduleDevicePickerRelayAssignedQuery = graphql`
  query scheduleDevicePickerRelayAssignedQuery(
    $scheduleId: ID!
    $filter: DeviceFilterInput
    $search: String
    $first: Int!
    $after: String
  ) {
    scriptSchedule(id: $scheduleId) {
      id
      deviceCount
      ...scheduleDevicePickerRelay_schedule
        @arguments(filter: $filter, search: $search, first: $first, after: $after)
    }
  }
`;

export const scheduleDevicePickerRelayAssignedFragment = graphql`
  fragment scheduleDevicePickerRelay_schedule on ScriptSchedule
    @refetchable(queryName: "scheduleDevicePickerRelayAssignedPaginationQuery")
    @argumentDefinitions(
      filter: { type: "DeviceFilterInput" }
      search: { type: "String" }
      first: { type: "Int", defaultValue: 20 }
      after: { type: "String" }
    ) {
    assignedDevices(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "scheduleDevicePickerRelay_assignedDevices") {
      filteredCount
      edges {
        node {
          id
          machineId
          hostname
          displayName
          osType
          status
          lastSeen
          type
          manufacturer
          model
          serialNumber
          organization {
            id
            organizationId
            name
            image {
              imageUrl
              hash
            }
            contactInformation {
              contacts {
                email
              }
            }
          }
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
