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
 * Unlike the executions pair there is no server facets field — the only filter
 * is `statuses`, whose options are the `ScriptExecutionStatus` enum, so the
 * dropdown is built client-side from the generated enum.
 */
export const scheduleRunsRelayQuery = graphql`
  query scheduleRunsRelayQuery(
    $scheduleId: ID!
    $filter: ScheduleRunFilterInput
    $search: String
    $first: Int!
    $after: String
  ) {
    ...scheduleRunsRelay_query
      @arguments(scheduleId: $scheduleId, filter: $filter, search: $search, first: $first, after: $after)
  }
`;

export const scheduleRunsRelayFragment = graphql`
  fragment scheduleRunsRelay_query on Query
    @refetchable(queryName: "scheduleRunsRelayPaginationQuery")
    @argumentDefinitions(
      scheduleId: { type: "ID!" }
      filter: { type: "ScheduleRunFilterInput" }
      search: { type: "String" }
      first: { type: "Int", defaultValue: 20 }
      after: { type: "String" }
    ) {
    scheduleRuns(scheduleId: $scheduleId, filter: $filter, search: $search, first: $first, after: $after)
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
