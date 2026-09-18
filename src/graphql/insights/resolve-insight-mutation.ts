import { graphql } from 'react-relay';

/** Any open status → resolved. See `acknowledgeInsightMutation` for the payload shape. */
export const resolveInsightMutation = graphql`
  mutation resolveInsightMutation($input: InsightIdInput!) {
    resolveInsight(input: $input) {
      id
      status
      snoozedUntil
    }
  }
`;
