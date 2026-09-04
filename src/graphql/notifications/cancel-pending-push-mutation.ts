import { graphql } from 'react-relay';

export const cancelPendingPushMutation = graphql`
  mutation cancelPendingPushMutation($notificationId: ObjectId!) {
    cancelPendingPush(notificationId: $notificationId)
  }
`;
