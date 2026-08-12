import { graphql } from 'react-relay';

/**
 * Execution-history list for a single script (v2 — native OpenFrame GraphQL API
 * via Relay). Mirrors the cursor-paginated `scriptExecutions(scriptId, ...)`
 * connection. Status / Device / "Executed by" filters plus the free-text
 * `search` are all pushed to the server; the pagination fragment drives infinite
 * scroll.
 *
 * `scriptExecutionFilters` (the filter facets) rides the SAME operation, so each
 * filter/search interaction is a single round-trip and the dropdown options
 * update atomically with the rows. It sits on the outer query — not in the
 * `@refetchable` fragment — so `loadNext` pagination does not refetch it. Facet
 * semantics: the backend excludes each facet's OWN group when narrowing, so a
 * group's options never vanish while the user multi-selects within it. Option
 * `value`s match the `ScriptExecutionFilterInput` fields (statuses = enum,
 * initiators = user global id, machines = machineId).
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
    $first: Int!
    $after: String
  ) {
    ...scriptExecutionsRelay_query
      @arguments(scriptId: $scriptId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
    scriptExecutionFilters(scriptId: $scriptId, filter: $filter, search: $search) {
      ...executionFacets_filters
    }
  }
`;

export const scriptExecutionsRelayFragment = graphql`
  fragment scriptExecutionsRelay_query on Query
    @refetchable(queryName: "scriptExecutionsRelayPaginationQuery")
    @argumentDefinitions(
      scriptId: { type: "ID!" }
      filter: { type: "ScriptExecutionFilterInput" }
      search: { type: "String" }
      sort: { type: "SortInput" }
      first: { type: "Int", defaultValue: 20 }
      after: { type: "String" }
    ) {
    scriptExecutions(scriptId: $scriptId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
      @connection(key: "scriptExecutionsRelay_scriptExecutions") {
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
        endCursor
      }
    }
  }
`;
