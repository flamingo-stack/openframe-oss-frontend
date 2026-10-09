import { graphql } from 'react-relay';

/**
 * The newest-enrolled machine and how far its agents have come - what the setup
 * wizard's "Deploy First Device" checklist polls while the admin runs the install
 * command, and what "You are ready to go" names.
 *
 * `first: 1` without a sort: a workspace on this screen has at most one device
 * worth reporting, and the ready screen only needs a name to greet with.
 */
export const firstDeviceEnrollmentRelayQuery = graphql`
  query firstDeviceEnrollmentRelayQuery($filter: DeviceFilterInput) {
    devices(first: 1, filter: $filter) {
      edges {
        node {
          id
          hostname
          displayName
          status
          toolConnections {
            toolType
            status
          }
        }
      }
    }
  }
`;
