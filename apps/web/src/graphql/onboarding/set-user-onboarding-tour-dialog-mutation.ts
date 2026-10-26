import { graphql } from 'react-relay';

export const setUserOnboardingTourDialogMutation = graphql`
  mutation setUserOnboardingTourDialogMutation($dialogId: String!) {
    setUserOnboardingTourDialog(dialogId: $dialogId) {
      completedSteps
      completed
      completedAt
      skipped
      skippedAt
      tourDialogId
    }
  }
`;
