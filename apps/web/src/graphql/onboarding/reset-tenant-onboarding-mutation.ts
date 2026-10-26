import { graphql } from 'react-relay';

// Dev/QA only: the field exists in the schema only where flag onboarding-skip is on.
export const resetTenantOnboardingMutation = graphql`
  mutation resetTenantOnboardingMutation {
    resetTenantOnboarding {
      completedSteps
      completed
      completedAt
    }
  }
`;
