import { graphql } from 'react-relay';

/**
 * The online devices (managed and online right now; the filter is the caller's, built by `toRelayDeviceFilter`)
 * "What to ask Mingo?" names in its prompts: their id (for
 * the `record://device/<id>` link the prompt is sent with), their name (nickname ->
 * displayName -> hostname, shown on the chip), what kind of device each is and
 * its OS. Fetched once per click, never kept on screen, so not a connection.
 */
export const whatToAskDevicesRelayQuery = graphql`
  query whatToAskDevicesRelayQuery($filter: DeviceFilterInput, $first: Int!) {
    devices(filter: $filter, first: $first) {
      edges {
        node {
          id
          machineId
          hostname
          displayName
          nickname
          type
          osType
        }
      }
    }
  }
`;
