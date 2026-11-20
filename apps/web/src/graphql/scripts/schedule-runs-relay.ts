import { graphql } from 'react-relay';

/**
 * Schedule Runs — one row per *fire* of a schedule (one dispatch to its
 * assigned devices), the aggregate above the flat per-device execution history
 * (`schedule-executions-relay.ts`). A run's `executionId` is the shared id its
 * executions carry; a row opens the run's own page, which lists them.
 *
 * `respondedMachineCount / totalMachineCount` backs the progress ratio
 * (responded = devices we have processed at least one result from).
 *
 * One page per request, its cursor in the URL (`runCursor`): no `@connection`,
 * so a cursor from a link reads exactly its page. The list pages back on the
 * server (`last` / `before` return the page before the cursor), so the query
 * takes all four page arguments; the pager sets the pair it uses and leaves the
 * other null.
 *
 * `scheduleRunFilters` rides along in the same operation, the way
 * `scheduleExecutionFilters` does for the executions lists: one round-trip per
 * interaction, and the counts describe the same scope the rows were fetched
 * with because both take the same `filter`/`search`. A page move asks for them
 * again with the same scope (the same answer).
 *
 * Only `statuses` is wired to a funnel. `initiators` comes back too, but
 * `ScheduleRunFilterInput` has no field to apply it, so selecting from it could
 * not narrow anything, and it is not offered.
 *
 * `sort` (`{ field: "dispatchedAt", direction }`) and `dispatchedAtFrom` /
 * `dispatchedAtTo` inside `filter` are the Execution column's calendar — the
 * same pair the two Execution History lists use, on the field a run is keyed by.
 */
export const scheduleRunsRelayQuery = graphql`
  query scheduleRunsRelayQuery(
    $scheduleId: ID!
    $filter: ScheduleRunFilterInput
    $search: String
    $sort: SortInput
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    scheduleRunFilters(scheduleId: $scheduleId, filter: $filter, search: $search) {
      statuses {
        value
        label
        count
      }
    }
    scheduleRuns(
      scheduleId: $scheduleId
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      filteredCount
      edges {
        node {
          id
          executionId
          status
          totalMachineCount
          respondedMachineCount
          dispatchedAt
          initiator {
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
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;
