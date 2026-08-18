import { graphql } from 'react-relay';

/**
 * Schedule Runs — one row per *fire* of a schedule (one dispatch to its
 * assigned devices), the aggregate above the flat per-device execution history
 * (`schedule-executions-relay.ts`). A run's `executionId` is the shared id its
 * executions carry, so a row drills down by handing that id to the Execution
 * History tab's search.
 *
 * `respondedMachineCount / totalMachineCount` backs the progress ratio
 * (responded = devices we have processed at least one result from).
 *
 * `scheduleRunFilters` rides along in the same operation, the way
 * `scheduleExecutionFilters` does for the executions pair: one round-trip per
 * interaction, and the counts describe the same scope the rows were fetched
 * with because both take the same `filter`/`search`.
 *
 * Only `statuses` is wired to a funnel. `initiators` comes back too, but
 * `ScheduleRunFilterInput` has no field to apply it — see §11 of
 * docs/script-schedules-v2-graphql-gaps.md — so selecting from it could not
 * narrow anything, and it is not offered.
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
    $first: Int!
    $after: String
  ) {
    scheduleRunFilters(scheduleId: $scheduleId, filter: $filter, search: $search) {
      statuses {
        value
        label
        count
      }
    }
    ...scheduleRunsRelay_query
      @arguments(scheduleId: $scheduleId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
  }
`;

export const scheduleRunsRelayFragment = graphql`
  fragment scheduleRunsRelay_query on Query
    @refetchable(queryName: "scheduleRunsRelayPaginationQuery")
    @argumentDefinitions(
      scheduleId: { type: "ID!" }
      filter: { type: "ScheduleRunFilterInput" }
      search: { type: "String" }
      sort: { type: "SortInput" }
      first: { type: "Int", defaultValue: 20 }
      after: { type: "String" }
    ) {
    scheduleRuns(scheduleId: $scheduleId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
      @connection(key: "scheduleRunsRelay_scheduleRuns") {
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
        endCursor
      }
    }
  }
`;
