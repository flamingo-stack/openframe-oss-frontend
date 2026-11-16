import { graphql } from 'react-relay';

/**
 * The outdated-client facet alone: the `"true"` count is how many devices under the filter run a client below the
 * server's supported version. Read by the Status funnel's OUTDATED option and by the outdated-client bar.
 *
 * A document of its own, apart from `deviceFiltersRelayQuery`, on purpose: `deviceFilters` is non-null, so a failed
 * facet fails its whole document, and this one reads a Pinot column saas-shared adds on its own release. In the shared
 * document it would take every funnel on the list and in the schedule and bundle pickers with it, and the pickers would
 * pay one more Pinot query for a count they never show.
 *
 * `$list` guards the root field for `useNonSuspendingQuery`, which reads it with `list: false` until the answer lands.
 */
export const outdatedClientCountRelayQuery = graphql`
  query outdatedClientCountRelayQuery($filter: DeviceFilterInput, $list: Boolean!) {
    deviceFilters(filter: $filter) @include(if: $list) {
      clientOutdated {
        value
        count
      }
    }
  }
`;
