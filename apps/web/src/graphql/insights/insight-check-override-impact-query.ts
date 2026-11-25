import { graphql } from 'react-relay';

/**
 * What an override at one customer, tag or device would meet before it is saved: how many devices
 * it covers, and how many of them another override takes over.
 */
export const insightCheckOverrideImpactQuery = graphql`
  query insightCheckOverrideImpactQuery($check: String!, $scopeType: InsightCheckScopeType!, $scopeId: String!) {
    insightCheckOverrideImpact(check: $check, scopeType: $scopeType, scopeId: $scopeId) {
      deviceCount
      affectedDeviceCount
    }
  }
`;
