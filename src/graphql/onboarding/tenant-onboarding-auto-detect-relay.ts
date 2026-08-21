import { graphql } from 'react-relay';

/**
 * ⚠️ TEMPORARY — part of the client-side auto-detect stopgap; remove once the backend
 * computes step completion in `tenantOnboardingProgress`. See `useTenantOnboardingAutoDetect`.
 *
 * The three signals that detect needs, in one round-trip:
 *   - `tenantInfo`    — MSP profile completeness (name + website + logo)
 *   - `organizations` — whether any org is NOT the default one, i.e. whether a real
 *     customer exists. A two-row page, not a count: the schema has no `isDefault`
 *     filter, and a count can't tell one customer from just the default org without
 *     assuming the default is always seeded. There is at most one default, so two rows
 *     always expose a non-default node if a customer exists.
 *   - `deviceFilters` — connected devices; the caller passes `statuses:[ONLINE,OFFLINE]`
 *     so archived/pending ones don't count.
 */
export const tenantOnboardingAutoDetectRelayQuery = graphql`
  query tenantOnboardingAutoDetectRelayQuery($deviceFilter: DeviceFilterInput) {
    tenantInfo {
      name
      website
      image {
        imageUrl
      }
    }
    organizations(first: 2) {
      edges {
        node {
          id
          isDefault
        }
      }
    }
    deviceFilters(filter: $deviceFilter) {
      filteredCount
    }
  }
`;
