import { graphql } from 'react-relay';

/**
 * Execution history for a single SCHEDULE — the per-script
 * `scriptExecutions(scriptId:)` query (`script-executions-relay.ts`) keyed by
 * `scheduleId` instead. Rows are the same `ScriptExecution` records the
 * schedule produced (stamped with `scheduleId` at dispatch), so the table, the
 * filters and the row → execution-details link are shared with the script tab.
 *
 * Two operations over the same connection, one per consumer:
 *
 * - {@link scheduleExecutionsRelayPagedQuery} — the schedule's Execution History
 *   tab: one page per request, its cursor in the URL (`execCursor`), no
 *   `@connection`, so a cursor from a link reads exactly its page. The list
 *   pages back on the server, so it takes all four page arguments.
 * - {@link scheduleExecutionsRelayQuery} + its `@refetchable` fragment — the
 *   Schedule Run Details page, still on infinite scroll: its `search` is spent
 *   on the run's executionId, so the user's term narrows the loaded rows on the
 *   client, and the scroll sentinel walks the remaining pages for it.
 *
 * `scheduleExecutionFilters` (the facets) rides each operation. Facet semantics
 * match `scriptExecutionFilters`: the backend excludes each facet's OWN group
 * when narrowing, so a group's options don't vanish while the user
 * multi-selects within it.
 *
 * `sort` (`{ field: "dispatchedAt", direction }`) and the date range in `filter`
 * come from the Execution column's calendar, exactly as on the per-script query.
 */
export const scheduleExecutionsRelayPagedQuery = graphql`
  query scheduleExecutionsRelayPagedQuery(
    $scheduleId: ID!
    $filter: ScriptExecutionFilterInput
    $search: String
    $sort: SortInput
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    scheduleExecutions(
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
          # The shared row selection (execution-fields.ts).
          ...executionFields_execution
          # The second line of the "Executed by" cell, and the one field this
          # list adds to that fragment. A schedule runs SEVERAL scripts, so
          # which one this row is stays the open question here — the schedule
          # itself is already the page title. The per-script tab does not select
          # it (there it would repeat its own page title), which is what keeps
          # that line off those rows.
          scriptName
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
    # A page move asks for the facets again with the same filter and search
    # (the same answer); a facets query of its own would save that if it ever
    # shows up as slow.
    scheduleExecutionFilters(scheduleId: $scheduleId, filter: $filter, search: $search) {
      ...executionFacets_filters
    }
  }
`;

/**
 * The Schedule Run Details page's executions (infinite scroll, see above). The
 * facets sit on the outer query — not in the `@refetchable` fragment — so
 * `loadNext` pagination never refetches them.
 */
export const scheduleExecutionsRelayQuery = graphql`
  query scheduleExecutionsRelayQuery(
    $scheduleId: ID!
    $filter: ScriptExecutionFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...scheduleExecutionsRelay_query
      @arguments(scheduleId: $scheduleId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
    scheduleExecutionFilters(scheduleId: $scheduleId, filter: $filter, search: $search) {
      ...executionFacets_filters
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
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    scheduleExecutions(
      scheduleId: $scheduleId
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
    ) @connection(key: "scheduleExecutionsRelay_scheduleExecutions") {
      filteredCount
      edges {
        node {
          # The shared row selection (execution-fields.ts), and the script
          # name the paged query above selects for the same reason.
          ...executionFields_execution
          scriptName
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
