import { graphql } from 'react-relay';

/** The Checks list: every built-in check as it runs at GLOBAL, with its default thresholds and override count. */
export const insightChecksListQuery = graphql`
  query insightChecksListQuery {
    insightChecks(scopeType: GLOBAL) {
      ...insightCheckFields_insightCheck
    }
  }
`;
