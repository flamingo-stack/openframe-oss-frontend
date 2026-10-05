import { graphql } from 'react-relay';

/**
 * Incident details page query. `insight(id:)` errors (rather than returning
 * null) for an unknown id, so a bad id lands in the page's error boundary.
 */
export const incidentDetailRelayQuery = graphql`
  query incidentDetailRelayQuery($id: ID!) {
    insight(id: $id) {
      ...insightFields_insight
    }
    ...insightTransitions_query
  }
`;
