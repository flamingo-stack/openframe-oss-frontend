import { graphql } from 'react-relay';

/**
 * "Processed Devices" on the execution details page: the package's runs counted
 * by status, unfiltered — so the figure does not move with the log filters below.
 */
export const softwareExecutionSummaryRelayQuery = graphql`
  query softwareExecutionSummaryRelayQuery(
    $packageManager: PackageManagerType!
    $packageName: String!
    $action: SoftwareAction!
  ) {
    softwareExecutionFilters(packageManager: $packageManager, packageName: $packageName, action: $action) {
      filteredCount
      statuses {
        value
        count
      }
    }
  }
`;
