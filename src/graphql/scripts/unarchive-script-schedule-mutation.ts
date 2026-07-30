import { graphql } from 'react-relay';

/**
 * Restores an archived schedule back to ACTIVE. `@deleteEdge(connections:)`
 * removes its edge from the Archived list's connection WITHOUT deleting the
 * record; the active Schedules page refetches (`store-and-network`) on
 * navigation and shows it there. See `archive-script-mutation.ts` for why this
 * is `@deleteEdge`, not `@deleteRecord`.
 */
export const unarchiveScriptScheduleMutation = graphql`
  mutation unarchiveScriptScheduleMutation($id: ID!, $connections: [ID!]!) {
    unarchiveScriptSchedule(id: $id) {
      id @deleteEdge(connections: $connections)
      # Not for the list (the edge is gone by then) but for the DETAILS page,
      # which stays mounted on the archived schedule: the payload writes the new
      # status straight into the record, so its action flips Archive <-> Restore
      # without a refetch.
      status
    }
  }
`;
