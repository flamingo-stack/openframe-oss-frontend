import { graphql } from 'react-relay';

/**
 * The status-transition table the mutations enforce, so the row menu and the
 * detail header offer exactly what the server will accept instead of restating
 * the rules (which drifted once already). Spread in the list and detail
 * queries — one extra field on a request already in flight, no round trip —
 * and read by `toTransitionTable`, a plain function, hence `@inline`.
 */
export const insightTransitionsFragment = graphql`
  fragment insightTransitions_query on Query @inline {
    insightStatusTransitions {
      from
      to
    }
  }
`;
