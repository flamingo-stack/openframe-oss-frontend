import { graphql } from 'react-relay';

/**
 * ⚠️ TEMPORARY — part of the client-side onboarding auto-detect stopgap; remove once the
 * backend computes step completion in `tenantOnboardingProgress`. See
 * `useTenantOnboardingAutoDetect` for the full rationale.
 *
 * The three schema-backed signals the tenant "Initial Setup" auto-detect needs, in a
 * single round-trip (see `useTenantOnboardingAutoDetect`):
 *   - `tenantInfo`   — MSP profile completeness (name + website + logo)
 *   - `organizations` — whether any org is NOT the tenant's default one, i.e.
 *     whether a real customer exists. Asked as a two-row page rather than a
 *     count: the schema has no `isDefault` filter, and counting can't tell
 *     "one customer" from "just the default org" without assuming the default
 *     is always there. Two rows are enough — there is at most ONE default, so
 *     any workspace with a customer shows a non-default node within the first
 *     two, whether or not it was seeded with a default.
 *   - `deviceFilters` — connected-device count; the caller passes `statuses:[ONLINE,OFFLINE]`
 *     so archived/pending devices do NOT count as "a device connected"
 *
 * Fetched with `network-only` so every dashboard visit reflects current data. The user
 * count is NOT here — it comes from the REST `api/users` list, whose `totalElements`
 * matches Settings → Employees (the GraphQL `users` count did not).
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
