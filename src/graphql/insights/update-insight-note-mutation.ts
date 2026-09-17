import { graphql } from 'react-relay';

/** Rewrites a note's text (author only). The payload updates the note record in place. */
export const updateInsightNoteMutation = graphql`
  mutation updateInsightNoteMutation($input: UpdateInsightNoteInput!) {
    updateInsightNote(input: $input) {
      id
      content
      updatedAt
    }
  }
`;
