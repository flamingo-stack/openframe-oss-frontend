import { graphql } from 'react-relay';

/** Drops what one scope stores for one check, so it inherits everything again. Admins and owners only. */
export const resetInsightCheckSettingMutation = graphql`
  mutation resetInsightCheckSettingMutation($input: ResetInsightCheckSettingInput!) {
    resetInsightCheckSetting(input: $input) {
      ...insightCheckFields_insightCheck
    }
  }
`;
