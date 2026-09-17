import { graphql } from 'react-relay';

/**
 * Hands the incident to one technician (replacing whoever held it) — independent
 * of status. The payload rewrites the record's assignee in place.
 */
export const assignInsightMutation = graphql`
  mutation assignInsightMutation($input: AssignInsightInput!) {
    assignInsight(input: $input) {
      id
      assigneeId
      assignee {
        ...insightUserFields_user
      }
    }
  }
`;
