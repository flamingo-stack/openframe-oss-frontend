import { graphql } from 'react-relay';

/**
 * ⚠️ TEMPORARY — part of the client-side onboarding auto-detect stopgap; remove once the
 * backend computes step completion in `tenantOnboardingProgress`. See
 * `useTenantOnboardingAutoDetect` for the full rationale.
 *
 * The three schema-backed signals the tenant "Initial Setup" auto-detect needs, in a
 * single round-trip (see `useTenantOnboardingAutoDetect`):
 *   - `tenantInfo`   — MSP profile completeness (name + website + logo)
 *   - `organizations` — customer count (`filteredCount`)
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
    organizations(first: 1) {
      filteredCount
    }
    deviceFilters(filter: $deviceFilter) {
      filteredCount
    }
  }
`;
