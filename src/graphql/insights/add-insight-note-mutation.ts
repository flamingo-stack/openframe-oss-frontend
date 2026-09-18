import { graphql } from 'react-relay';

/**
 * Adds a note; the caller becomes its author. `@prependNode` puts the new note
 * at the top of the detail page's notes connection (newest first), wrapped in
 * an `InsightNoteEdge` — no hand-written updater.
 */
export const addInsightNoteMutation = graphql`
  mutation addInsightNoteMutation($input: AddInsightNoteInput!, $connections: [ID!]!) {
    addInsightNote(input: $input) @prependNode(connections: $connections, edgeTypeName: "InsightNoteEdge") {
      id
      content
      authorId
      author {
        ...insightUserFields_user
      }
      createdAt
    }
  }
`;
