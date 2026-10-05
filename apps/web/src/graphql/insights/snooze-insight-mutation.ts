import { graphql } from 'react-relay';

/** new | acknowledged → snoozed until `until`. See `acknowledgeInsightMutation` for the payload shape. */
export const snoozeInsightMutation = graphql`
  mutation snoozeInsightMutation($input: SnoozeInsightInput!) {
    snoozeInsight(input: $input) {
      id
      status
      snoozedUntil
    }
  }
`;
