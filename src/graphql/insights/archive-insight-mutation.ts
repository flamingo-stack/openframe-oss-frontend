import { graphql } from 'react-relay';

/** resolved → archived. See `acknowledgeInsightMutation` for the payload shape. */
export const archiveInsightMutation = graphql`
  mutation archiveInsightMutation($input: InsightIdInput!) {
    archiveInsight(input: $input) {
      id
      status
      snoozedUntil
    }
  }
`;
