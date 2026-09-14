import { graphql } from 'react-relay';

export const markNotificationsReadForEntityMutation = graphql`
  mutation markNotificationsReadForEntityMutation($entityType: NotificationEntityType!, $entityId: ID!) {
    markNotificationsReadForEntity(entityType: $entityType, entityId: $entityId)
  }
`;
