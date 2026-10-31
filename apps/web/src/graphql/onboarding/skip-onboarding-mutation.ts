import { graphql } from 'react-relay';

// Dev/QA only: the field exists in the schema only where flag onboarding-skip is on.
export const skipOnboardingMutation = graphql`
  mutation skipOnboardingMutation {
    skipOnboarding {
      tenant {
        completedSteps
        completed
        completedAt
      }
      user {
        completedSteps
        completed
        completedAt
        skipped
        skippedAt
        tourDialogId
        setupSeen
      }
    }
  }
`;
