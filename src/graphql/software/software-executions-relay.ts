import { graphql } from 'react-relay';

/**
 * Execution history for one catalog package's install or update runs —
 * `softwareExecutions(packageManager, packageName, action)`, the software twin of
 * `scriptExecutions`. Same connection shape and filters, so the rows feed the
 * shared executions table unchanged; the facets ride the same operation for the
 * reason given in `script-executions-relay.ts`.
 */
export const softwareExecutionsRelayQuery = graphql`
  query softwareExecutionsRelayQuery(
    $packageManager: PackageManagerType!
    $packageName: String!
    $action: SoftwareAction!
    $filter: ScriptExecutionFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...softwareExecutionsRelay_query
      @arguments(
        packageManager: $packageManager
        packageName: $packageName
        action: $action
        filter: $filter
        search: $search
        sort: $sort
        first: $first
        after: $after
      )
    softwareExecutionFilters(
      packageManager: $packageManager
      packageName: $packageName
      action: $action
      filter: $filter
      search: $search
    ) {
      ...executionFacets_filters
    }
  }
`;

export const softwareExecutionsRelayFragment = graphql`
  fragment softwareExecutionsRelay_query on Query
  @refetchable(queryName: "softwareExecutionsRelayPaginationQuery")
  @argumentDefinitions(
    packageManager: { type: "PackageManagerType!" }
    packageName: { type: "String!" }
    action: { type: "SoftwareAction!" }
    filter: { type: "ScriptExecutionFilterInput" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwareExecutions(
      packageManager: $packageManager
      packageName: $packageName
      action: $action
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
    ) @connection(key: "softwareExecutionsRelay_softwareExecutions") {
      filteredCount
      edges {
        node {
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
