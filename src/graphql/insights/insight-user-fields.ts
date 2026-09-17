import { graphql } from 'react-relay';

/**
 * The `User` a record points at — an incident's assignee, a note's author —
 * as the page draws it: name, avatar, and whether the account is deleted.
 * One selection for every operation that resolves a user, read by
 * `toIncidentUser` (`incidents/utils/incident-transform.ts`), so an
 * operation cannot drop `status` and silently render a deleted user as live.
 */
export const insightUserFieldsFragment = graphql`
  fragment insightUserFields_user on User @inline {
    id
    firstName
    lastName
    email
    status
    image {
      imageUrl
      hash
    }
  }
`;
