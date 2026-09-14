import { graphql } from 'react-relay';

/**
 * Package-manager catalog search behind the Install Software "Software Name"
 * picker (Homebrew / Chocolatey / winget).
 *
 * `@include(if: $hasQuery)`: a query under 2 characters is not worth sending,
 * so the box selects nothing until then — read with `store-only`, that renders
 * without a request.
 */
export const installSoftwarePackageSearchRelayQuery = graphql`
  query installSoftwarePackageSearchRelayQuery(
    $packageManager: PackageManagerType!
    $search: String!
    $first: Int!
    $hasQuery: Boolean!
  ) {
    searchPackages(packageManager: $packageManager, search: $search, first: $first) @include(if: $hasQuery) {
      edges {
        node {
          id
          name
          description
          version
          packageType
        }
      }
    }
  }
`;
