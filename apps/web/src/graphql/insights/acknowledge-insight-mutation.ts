import { graphql } from 'react-relay';

/**
 * new | snoozed → acknowledged. Returns the fields a transition changes, so the
 * payload rewrites the Insight record in place and every list row / detail
 * header subscribed to it re-renders — no refetch, no connection updater.
 * Which transition is legal from which status is `transitionsFrom`
 * (`incidents/utils/incident-labels.ts`), a mirror of the backend validator.
 */
export const acknowledgeInsightMutation = graphql`
  mutation acknowledgeInsightMutation($input: InsightIdInput!) {
    acknowledgeInsight(input: $input) {
      id
      status
      snoozedUntil
    }
  }
`;
