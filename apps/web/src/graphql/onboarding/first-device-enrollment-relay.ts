import { graphql } from 'react-relay';

/**
 * The newest machine and how far its enrollment has come - what the setup
 * wizard's "Deploy First Device" checklist polls while the admin runs the
 * install command, and what "You are ready to go" names.
 *
 * Newest by `lastSeen` (the enrollment stamps are not sortable), through
 * `devices` rather than `deviceFilters`: the latter is served from Pinot and
 * lags the stages by minutes.
 */
export const firstDeviceEnrollmentRelayQuery = graphql`
  query firstDeviceEnrollmentRelayQuery($filter: DeviceFilterInput, $sort: SortInput) {
    devices(first: 1, filter: $filter, sort: $sort) {
      edges {
        node {
          id
          hostname
          displayName
          status
          enrollment {
            registeredAt
            connectedAt
            inventoryConnectedAt
            ready
          }
        }
      }
    }
  }
`;
