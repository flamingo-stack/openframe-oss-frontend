import { graphql } from 'react-relay';

/** resolved | archived → new. See `acknowledgeInsightMutation` for the payload shape. */
export const reopenInsightMutation = graphql`
  mutation reopenInsightMutation($input: InsightIdInput!) {
    reopenInsight(input: $input) {
      id
      status
      snoozedUntil
    }
  }
`;
