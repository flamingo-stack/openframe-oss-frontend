import { graphql } from 'react-relay';

export const markUserOnboardingSetupSeenMutation = graphql`
  mutation markUserOnboardingSetupSeenMutation {
    markUserOnboardingSetupSeen {
      completedSteps
      completed
      completedAt
      skipped
      skippedAt
      tourDialogId
      setupSeen
    }
  }
`;
