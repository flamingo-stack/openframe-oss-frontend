import { graphql } from 'react-relay';

/** One check's page: the check as it runs at GLOBAL and every override it has, the most specific first. */
export const insightCheckPageQuery = graphql`
  query insightCheckPageQuery($check: String!) {
    insightCheck(check: $check) {
      ...insightCheckFields_insightCheck
      overrides {
        ...insightCheckOverrideFields_override
      }
    }
  }
`;
