import { graphql } from 'react-relay';

/**
 * Replaces what one scope stores for one check: `enabled: null` and a parameter left out inherit
 * again. Admins and owners only. Sending neither `enabled` nor a parameter is refused: that is
 * `resetInsightCheckSettingMutation`.
 */
export const updateInsightCheckSettingMutation = graphql`
  mutation updateInsightCheckSettingMutation($input: UpdateInsightCheckSettingInput!) {
    updateInsightCheckSetting(input: $input) {
      ...insightCheckFields_insightCheck
    }
  }
`;
