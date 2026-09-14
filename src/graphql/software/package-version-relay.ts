import { graphql } from 'react-relay';

/** A catalog package's newest published version — "Package Version" on the execution details page. */
export const packageVersionRelayQuery = graphql`
  query packageVersionRelayQuery($packageManager: PackageManagerType!, $packageId: ID!, $packageType: BrewPackageType) {
    packageDetails(packageManager: $packageManager, packageId: $packageId, packageType: $packageType) {
      versions {
        version
      }
    }
  }
`;
