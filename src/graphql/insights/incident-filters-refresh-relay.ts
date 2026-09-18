import { graphql } from 'react-relay';

/**
 * Imperative refresh of the incidents-list facets after a status transition.
 * The facets normally ride the list operation (`incidentsTableRelayQuery`), but
 * a mutation only rewrites the one Insight record — the status counts (and the
 * total) it was aggregated into stay as fetched.
 *
 * Spreads the same `insightFacets_filters` off the same `insightFilters(filter,
 * search)` field, so `fetchQuery(...).subscribe({})` writes into the same store
 * records and every mounted subscriber re-renders with the fresh counts —
 * without refetching the list itself.
 */
export const incidentFiltersRefreshRelayQuery = graphql`
  query incidentFiltersRefreshRelayQuery($filter: InsightFilter, $search: String) {
    insightFilters(filter: $filter, search: $search) {
      ...insightFacets_filters
    }
  }
`;
