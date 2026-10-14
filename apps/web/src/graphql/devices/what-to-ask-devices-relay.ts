import { graphql } from 'react-relay';

/**
 * The online devices "What to ask Mingo?" names in its prompts: their name
 * (nickname -> displayName -> hostname), what kind of device each is and its
 * OS. Fetched once per click, never kept on screen, so not a connection.
 */
export const whatToAskDevicesRelayQuery = graphql`
  query whatToAskDevicesRelayQuery($first: Int!) {
    devices(filter: { statuses: [ONLINE] }, first: $first) {
      edges {
        node {
          id
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
