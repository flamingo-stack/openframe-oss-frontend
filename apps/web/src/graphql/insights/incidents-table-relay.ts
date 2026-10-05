import { graphql } from 'react-relay';

/**
 * Incidents list query over the `insights(...)` connection (saas-api).
 *
 * The filter facets (`insightFilters`) ride the SAME operation, so each filter
 * interaction is a single round-trip and the dropdown options update atomically
 * with the rows. They sit on the outer query — not in the `@refetchable`
 * fragment — so `loadNext` pagination does not re-aggregate them. Facet
 * semantics: the backend excludes each facet's OWN field when narrowing, so a
 * group's options never vanish while the user multi-selects within it, and
 * `filteredCount` is the total under the full filter (the "N results" label).
 */
export const incidentsTableRelayQuery = graphql`
  query incidentsTableRelayQuery($filter: InsightFilter, $search: String, $first: Int!, $after: String) {
    ...incidentsTableRelay_query @arguments(filter: $filter, search: $search, first: $first, after: $after)
    insightFilters(filter: $filter, search: $search) {
      ...insightFacets_filters
    }
    ...insightTransitions_query
  }
`;

export const incidentsTableRelayFragment = graphql`
  fragment incidentsTableRelay_query on Query
  @refetchable(queryName: "incidentsTableRelayPaginationQuery")
  @argumentDefinitions(
    filter: { type: "InsightFilter" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    insights(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "incidentsTableRelay_insights", filters: ["filter", "search"]) {
      __id
      edges {
        node {
          ...insightRowFields_insight
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
