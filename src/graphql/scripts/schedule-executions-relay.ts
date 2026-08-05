import { graphql } from 'react-relay';

/**
 * Execution history for a single SCHEDULE — the per-script
 * `scriptExecutions(scriptId:)` pair (`script-executions-relay.ts`) keyed by
 * `scheduleId` instead. Rows are the same `ScriptExecution` records the
 * schedule produced (stamped with `scheduleId` at dispatch), so the table, the
 * filters and the row → execution-details link are shared with the script tab.
 *
 * `scheduleExecutionFilters` (the facets) rides the SAME operation and sits on
 * the outer query — not in the `@refetchable` fragment — so `loadNext`
 * pagination never refetches it. Facet semantics match `scriptExecutionFilters`:
 * the backend excludes each facet's OWN group when narrowing, so a group's
 * options don't vanish while the user multi-selects within it.
 */
export const scheduleExecutionsRelayQuery = graphql`
  query scheduleExecutionsRelayQuery(
    $scheduleId: ID!
    $filter: ScriptExecutionFilterInput
    $search: String
    $first: Int!
    $after: String
  ) {
    ...scheduleExecutionsRelay_query
      @arguments(scheduleId: $scheduleId, filter: $filter, search: $search, first: $first, after: $after)
    scheduleExecutionFilters(scheduleId: $scheduleId, filter: $filter, search: $search) {
      statuses {
        value
        label
        count
      }
      initiators {
        value
        label
        count
      }
      machines {
        value
        label
        count
      }
    }
  }
`;

export const scheduleExecutionsRelayFragment = graphql`
  fragment scheduleExecutionsRelay_query on Query
    @refetchable(queryName: "scheduleExecutionsRelayPaginationQuery")
    @argumentDefinitions(
      scheduleId: { type: "ID!" }
      filter: { type: "ScriptExecutionFilterInput" }
      search: { type: "String" }
      first: { type: "Int", defaultValue: 20 }
      after: { type: "String" }
    ) {
    scheduleExecutions(scheduleId: $scheduleId, filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "scheduleExecutionsRelay_scheduleExecutions") {
      filteredCount
      edges {
        node {
          id
          executionId
          status
          dispatchedAt
          stdout
          stderr
          error
          # The second line of the "Executed by" cell. A schedule runs SEVERAL
          # scripts, so which one this row is stays the open question here — the
          # schedule itself is already the page title. The per-script tab does
          # not select it (there it would repeat its own page title), which is
          # what keeps that line off those rows.
          scriptName
          machine {
            id
            machineId
            hostname
            displayName
            organization {
              id
              name
            }
          }
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
