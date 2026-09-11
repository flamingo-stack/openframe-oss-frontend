import { graphql } from 'react-relay';

/**
 * Software → Vulnerabilities page: every CVE across the tenant's fleet, one row
 * per CVE (not one per CVE × software).
 */
export const vulnerabilitiesTableRelayQuery = graphql`
  query vulnerabilitiesTableRelayQuery(
    $filter: VulnerabilityFilterInput
    $search: String
    $first: Int!
    $after: String
  ) {
    ...vulnerabilitiesTableRelay_query @arguments(filter: $filter, search: $search, first: $first, after: $after)
  }
`;

export const vulnerabilitiesTableRelayFragment = graphql`
  fragment vulnerabilitiesTableRelay_query on Query
  @refetchable(queryName: "vulnerabilitiesTableRelayPaginationQuery")
  @argumentDefinitions(
    filter: { type: "VulnerabilityFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    vulnerabilities(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "vulnerabilitiesTableRelay_vulnerabilities") {
      filteredCount
      edges {
        node {
          cveId
          severity
          cvssScore
          publishedAt
          devicesCount
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
