import { graphql } from 'react-relay';

/**
 * One built-in check as a scope sees it: whether it runs and its thresholds, each value with the
 * scope it was taken from, and how many overrides it has. The list, the check page and the
 * mutations spread it; `toCheck` (`monitoring/checks/utils/check-transform.ts`) reads it. `id` is
 * the check at the scope asked about, so an answer at GLOBAL replaces the list's row and the page.
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
    type
    overrideCount
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
