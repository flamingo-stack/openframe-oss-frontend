import { graphql } from 'react-relay';

/**
 * Removes a note (author only). The mutation returns the removed note's id, so
 * `@deleteEdge` on the field itself drops its edge from the notes connection.
 */
export const deleteInsightNoteMutation = graphql`
  mutation deleteInsightNoteMutation($input: InsightNoteIdInput!, $connections: [ID!]!) {
    deleteInsightNote(input: $input) @deleteEdge(connections: $connections)
  }
`;
