import { graphql } from 'react-relay';

/**
 * Notes on one incident, newest first. A root query on the backend on purpose
 * (a list of insights must not pull notes per row), so it is its own operation
 * here too, loaded beside the detail query.
 *
 * `authorId` is the raw `User.id` the note was written under — compared to the
 * signed-in user's id to decide whose notes can be edited; `author.id` is the
 * node handle.
 */
export const incidentNotesRelayQuery = graphql`
  query incidentNotesRelayQuery($insightId: ID!, $first: Int!, $after: String) {
    ...incidentNotesRelay_query @arguments(insightId: $insightId, first: $first, after: $after)
  }
`;

export const incidentNotesRelayFragment = graphql`
  fragment incidentNotesRelay_query on Query
  @refetchable(queryName: "incidentNotesRelayPaginationQuery")
  @argumentDefinitions(
    insightId: { type: "ID!" }
    first: { type: "Int", defaultValue: 50 }
    after: { type: "String" }
  ) {
    insightNotes(insightId: $insightId, first: $first, after: $after)
      @connection(key: "incidentNotesRelay_insightNotes") {
      __id
      edges {
        node {
          id
          content
          authorId
          author {
            ...insightUserFields_user
          }
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
