import { graphql } from 'react-relay';

/**
 * Software list query — the fleet-wide `softwares(...)` connection (one row per
 * software title, aggregated across devices).
 *
 * Search, the version/severity scope of each Software tab and the sort are
 * pushed to the server; the pagination fragment drives infinite scroll.
 *
 * No `softwareFilters` facets ride along: the list has no filter funnels (the
 * design's header carries sort toggles only), and the per-tab scope is a fixed
 * `SoftwareFilterInput` the page owns, not something the user picks.
 */
export const softwaresTableRelayQuery = graphql`
  query softwaresTableRelayQuery(
    $filter: SoftwareFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...softwaresTableRelay_query @arguments(filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
  }
`;

export const softwaresTableRelayFragment = graphql`
  fragment softwaresTableRelay_query on Query
  @refetchable(queryName: "softwaresTableRelayPaginationQuery")
  @argumentDefinitions(
    filter: { type: "SoftwareFilterInput" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwares(filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
      @connection(key: "softwaresTableRelay_softwares") {
      filteredCount
      edges {
        node {
          id
          name
          publisher
          currentVersion
          versionStatus
          olderVersionsCount
          devicesCount
          cpeMatched
          vulnerabilitySummary {
            highestSeverity
            cveCount
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
