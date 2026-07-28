import { graphql } from 'react-relay';

/**
 * The "Available Devices" half of the schedule device picker.
 *
 * `availableDevicesForSchedule` is already scoped to the schedule's
 * `supportedPlatforms` server-side, so a platform-mismatched device is never
 * offered — the old page pulled the generic `devices` list and narrowed it in
 * the browser, which only worked for as long as the whole fleet fit in the one
 * page it fetched.
 *
 * Search, filters and paging all live on the server, so what the user sees IS
 * the full candidate set rather than the first page of it. That is what makes
 * "Add All Devices" honest: the same `filter`/`search` go to
 * `addAllDevicesToSchedule`, which resolves the set itself.
 *
 * Open question the UI is deliberately robust to: the field's contract does not
 * say whether it EXCLUDES already-assigned devices. Every row therefore offers
 * "add" unconditionally, and `addDevicesToSchedule` is documented idempotent —
 * so re-adding an assigned device is a no-op either way.
 */
export const scheduleDevicePickerRelayQuery = graphql`
  query scheduleDevicePickerRelayQuery(
    $scheduleId: ID!
    $filter: DeviceFilterInput
    $search: String
    $first: Int!
    $after: String
  ) {
    ...scheduleDevicePickerRelay_query
      @arguments(scheduleId: $scheduleId, filter: $filter, search: $search, first: $first, after: $after)
  }
`;

export const scheduleDevicePickerRelayFragment = graphql`
  fragment scheduleDevicePickerRelay_query on Query
    @refetchable(queryName: "scheduleDevicePickerRelayPaginationQuery")
    @argumentDefinitions(
      scheduleId: { type: "ID!" }
      filter: { type: "DeviceFilterInput" }
      search: { type: "String" }
      first: { type: "Int", defaultValue: 20 }
      after: { type: "String" }
    ) {
    availableDevicesForSchedule(
      scheduleId: $scheduleId
      filter: $filter
      search: $search
      first: $first
      after: $after
    ) @connection(key: "scheduleDevicePickerRelay_availableDevicesForSchedule") {
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
 * The tab label counts the assignment, which `deviceCount` would state
 * directly — but that field is unusable (see
 * docs/script-schedules-v2-graphql-gaps.md §9), so the label reads
 * `filteredCount` instead. Same number whenever nothing is narrowed, which is
 * the state the label is read in.
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
