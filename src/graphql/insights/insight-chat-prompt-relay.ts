import { graphql } from 'react-relay';

/**
 * "Fix with Mingo": the message the server wants dropped into a new chat about
 * this insight — the `@insight:` / `@device:` markers plus a short ask. Fetched
 * on click (`fetchQuery`), not rendered from the row: the marker carries the
 * STORED insight id and the ask is the server's, so neither can go stale here.
 */
export const insightChatPromptRelayQuery = graphql`
  query insightChatPromptRelayQuery($id: ID!) {
    insightChatPrompt(id: $id)
  }
`;
