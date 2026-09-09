import { graphql } from 'react-relay';

/**
 * Software → Vulnerabilities tab: the CVEs matched to this title. One row per
 * CVE, with the fleet version it affects and when it was published.
 */
export const softwareVulnerabilitiesRelayQuery = graphql`
  query softwareVulnerabilitiesRelayQuery(
    $softwareId: ID!
    $filter: SoftwareVulnerabilityFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...softwareVulnerabilitiesRelay_query
      @arguments(softwareId: $softwareId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
  }
`;

export const softwareVulnerabilitiesRelayFragment = graphql`
  fragment softwareVulnerabilitiesRelay_query on Query
  @refetchable(queryName: "softwareVulnerabilitiesRelayPaginationQuery")
  @argumentDefinitions(
    softwareId: { type: "ID!" }
    filter: { type: "SoftwareVulnerabilityFilterInput" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwareVulnerabilities(
      softwareId: $softwareId
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
    ) @connection(key: "softwareVulnerabilitiesRelay_softwareVulnerabilities") {
      filteredCount
      edges {
        node {
          cveId
          severity
          cvssScore
          affectedVersion
          publishedAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
