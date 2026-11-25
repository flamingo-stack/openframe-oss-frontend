import { graphql } from 'react-relay';

/**
 * One override of a check: what one customer, tag or device stores for it. Spread by the check
 * page's query and read by `toCheckOverride` (`monitoring/checks/utils/check-transform.ts`).
 */
export const insightCheckOverrideFieldsFragment = graphql`
  fragment insightCheckOverrideFields_override on InsightCheckOverride @inline {
    id
    scopeType
    scopeId
    scopeName
    enabled
    parameters {
      parameter
      value
    }
    deviceCount
    updatedAt
    updatedBy {
      firstName
      lastName
      email
    }
  }
`;
