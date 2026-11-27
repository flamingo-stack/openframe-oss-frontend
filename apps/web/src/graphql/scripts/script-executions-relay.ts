import { graphql } from 'react-relay';

/**
 * Execution-history list for a single script (v2 — native OpenFrame GraphQL API
 * via Relay). Mirrors the cursor-paginated `scriptExecutions(scriptId, ...)`
 * connection. Status / Device / "Executed by" filters plus the free-text
 * `search` are all pushed to the server.
 *
 * One page per request, its cursor in the URL (`execCursor`): no `@connection`,
 * so a cursor from a link reads exactly its page. The list pages back on the
 * server (`last` / `before` return the page before the cursor), so the query
 * takes all four page arguments; the pager sets the pair it uses and leaves the
 * other null.
 *
 * `scriptExecutionFilters` (the filter facets) rides the SAME operation, so each
 * filter/search interaction is a single round-trip and the dropdown options
 * update atomically with the rows. A page move asks for them again with the
 * same `filter` / `search` (the same answer); a facets query of its own would
 * save that if it ever shows up as slow. Facet semantics: the backend excludes
 * each facet's OWN group when narrowing, so a group's options never vanish
 * while the user multi-selects within it. Option `value`s match the
 * `ScriptExecutionFilterInput` fields (statuses = enum, initiators = user
 * global id, machines = machineId).
 *
 * `sort` is the dispatched-date order behind the Execution column's calendar
 * (`{ field: "dispatchedAt", direction }`); its range lands in the same `filter`
 * as the funnels, as `dispatchedAtFrom` / `dispatchedAtTo`. The facets take the
 * filter too, so their counts describe the dates on screen — but NOT the sort,
 * which cannot change which rows match.
 */
export const scriptExecutionsRelayQuery = graphql`
  query scriptExecutionsRelayQuery(
    $scriptId: ID!
    $filter: ScriptExecutionFilterInput
    $search: String
    $sort: SortInput
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    scriptExecutions(
      scriptId: $scriptId
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
          # The shared row selection (execution-fields.ts). This list shows no
          # script name, so it spreads that fragment and nothing else.
          ...executionFields_execution
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
    scriptExecutionFilters(scriptId: $scriptId, filter: $filter, search: $search) {
      ...executionFacets_filters
    }
  }
`;
