import { graphql } from 'react-relay';

/** Drops the current assignee. See `assignInsightMutation` for the payload shape. */
export const unassignInsightMutation = graphql`
  mutation unassignInsightMutation($input: InsightIdInput!) {
    unassignInsight(input: $input) {
      id
      assigneeId
      assignee {
        id
      }
    }
  }
`;
