import { graphql } from 'react-relay';

/**
 * Software → Devices tab: the machines carrying this title, each with its OWN
 * installed version and per-device status (OUTDATED / SCHEDULED_UPDATE / …).
 *
 * The machine itself is read through `deviceRowFields_machine`, the narrowest
 * step of the device field ladder — the row needs the name, status, customer
 * and type, which is exactly what that step selects, and `machineRowToDevice`
 * is the mapper that goes with it.
 */
export const softwareDevicesRelayQuery = graphql`
  query softwareDevicesRelayQuery(
    $softwareId: ID!
    $filter: SoftwareOnDeviceFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...softwareDevicesRelay_query
      @arguments(softwareId: $softwareId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
  }
`;

export const softwareDevicesRelayFragment = graphql`
  fragment softwareDevicesRelay_query on Query
  @refetchable(queryName: "softwareDevicesRelayPaginationQuery")
  @argumentDefinitions(
    softwareId: { type: "ID!" }
    filter: { type: "SoftwareOnDeviceFilterInput" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwareDevices(
      softwareId: $softwareId
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
    ) @connection(key: "softwareDevicesRelay_softwareDevices") {
      filteredCount
      edges {
        node {
          softwareVersion
          status
          device {
            ...deviceRowFields_machine
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
