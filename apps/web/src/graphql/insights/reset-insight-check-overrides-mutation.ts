import { graphql } from 'react-relay';

/** Deletes every customer, tag and device override of one check, keeping its default. Admins and owners only. */
export const resetInsightCheckOverridesMutation = graphql`
  mutation resetInsightCheckOverridesMutation($input: ResetInsightCheckOverridesInput!) {
    resetInsightCheckOverrides(input: $input) {
      ...insightCheckFields_insightCheck
      overrides {
        ...insightCheckOverrideFields_override
      }
    }
  }
`;
