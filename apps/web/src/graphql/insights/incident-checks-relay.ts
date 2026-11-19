import { graphql } from 'react-relay';

/**
 * The Checks tab: every built-in check at one scope. GLOBAL takes no `scopeId`; CUSTOMER an
 * `organizationId`, TAG a `Tag.id`, DEVICE a `machineId`.
 */
export const incidentChecksRelayQuery = graphql`
  query incidentChecksRelayQuery($scopeType: InsightCheckScopeType!, $scopeId: String) {
    insightChecks(scopeType: $scopeType, scopeId: $scopeId) {
      ...insightCheckFields_insightCheck
    }
  }
`;

/**
 * The name of the scope a URL names, for the picker that shows it before its own list has paged
 * to it and for the "Set for …" lines. Only the branch for the scope's type runs.
 */
export const incidentChecksRelayScopeNameQuery = graphql`
  query incidentChecksRelayScopeNameQuery(
    $organizationId: String!
    $machineId: String!
    $tagId: ID!
    $isCustomer: Boolean!
    $isDevice: Boolean!
    $isTag: Boolean!
  ) {
    organizationByOrganizationId(organizationId: $organizationId) @include(if: $isCustomer) {
      name
    }
    device(machineId: $machineId) @include(if: $isDevice) {
      hostname
      displayName
      nickname
    }
    node(id: $tagId) @include(if: $isTag) {
      ... on Tag {
        key
      }
    }
  }
`;
