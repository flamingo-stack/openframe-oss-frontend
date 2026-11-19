import { graphql } from 'react-relay';

/**
 * One built-in incident check as a scope sees it: whether it runs and its thresholds, each value
 * with the scope it was taken from. The list query and both mutations spread it, and
 * `toIncidentCheck` (`incidents/utils/incident-check-transform.ts`) reads it. `id` is the check at
 * the scope asked about, so a mutation's answer replaces the row in the list.
 */
export const insightCheckFieldsFragment = graphql`
  fragment insightCheckFields_insightCheck on InsightCheck @inline {
    id
    check
    title
    platform
    description
    severity
    intervalSeconds
    enabled
    enabledScopeType
    enabledScopeId
    enabledScopeName
    customized
    parameters {
      parameter
      label
      unit
      firesWhen
      value
      defaultValue
      min
      max
      scopeType
      scopeId
      scopeName
    }
  }
`;
