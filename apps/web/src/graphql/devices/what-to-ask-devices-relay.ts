import { graphql } from 'react-relay';

/**
 * The online devices "What to ask Mingo?" names in its prompts: their id (for
 * the `@device:<id>` mention the prompt is sent with), their name (nickname ->
 * displayName -> hostname, shown on the chip), what kind of device each is and
 * its OS. Fetched once per click, never kept on screen, so not a connection.
 */
export const whatToAskDevicesRelayQuery = graphql`
  query whatToAskDevicesRelayQuery($first: Int!) {
    devices(filter: { statuses: [ONLINE] }, first: $first) {
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
