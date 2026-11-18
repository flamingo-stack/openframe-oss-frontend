import { graphql } from 'react-relay';

/**
 * One built-in incident check as a scope sees it: whether it runs and its thresholds, each value
 * with the scope it was taken from. The list query and both mutations spread it, and
 * `toIncidentCheck` (`incidents/utils/incident-check-transform.ts`) reads it.
 *
 * `InsightCheck` has no `id`, so Relay cannot merge a mutation's answer into the list: the
 * Checks tab refetches the list after a write (one scope's write moves what the others inherit
 * anyway).
 */
export const insightCheckFieldsFragment = graphql`
  fragment insightCheckFields_insightCheck on InsightCheck @inline {
    check
    kind
    platform
    description
    enabled
    enabledScopeType
    enabledScopeId
    customized
    parameters {
      parameter
      unit
      value
      defaultValue
      min
      max
      scopeType
      scopeId
    }
  }
`;
