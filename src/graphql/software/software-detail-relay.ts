import { graphql } from 'react-relay';

/**
 * The Software detail page's header + summary card: everything that identifies
 * one software title, and nothing the two tabs fetch for themselves.
 *
 * `software(id:)` is nullable — a bad or stale id resolves to null rather than
 * throwing, which is what the page reports as "not found".
 */
export const softwareDetailRelayQuery = graphql`
  query softwareDetailRelayQuery($id: ID!) {
    software(id: $id) {
      id
      name
      publisher
      latestVersion
    }
  }
`;
