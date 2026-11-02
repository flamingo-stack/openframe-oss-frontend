import {
  MINGO_APPROVAL_REQUEST_TYPE,
  type Notification,
  TICKET_APPROVAL_REQUEST_TYPE,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { fetchQuery, graphql } from 'react-relay';
import type { approvalNotificationsRelayQuery as ApprovalNotificationsRelayQueryType } from '@/__generated__/approvalNotificationsRelayQuery.graphql';
import { withNotificationIcon } from '@/app/components/notifications/notification-category-icons';
import { getRelayEnvironment } from '@/lib/relay';
import { mapNotificationNode, readNotificationNode } from './notifications-helpers';

/**
 * The viewer's unread approval request notifications, every page of them: the Needs
 * approval page's notification source. Filtered on the server by type, so a request whose
 * notification sits beyond the drawer's first page still shows. The rows are the drawer's
 * (`notificationFields_notification`), mapped the same way.
 */
export const approvalNotificationsRelayQuery = graphql`
  query approvalNotificationsRelayQuery($first: Int!, $after: String, $filter: NotificationFilterInput) {
    notifications(first: $first, after: $after, filter: $filter, search: null) {
      edges {
        node {
          ...notificationFields_notification
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const APPROVAL_NOTIFICATIONS_PAGE_SIZE = 20;

export const APPROVAL_NOTIFICATIONS_FILTER = {
  read: false,
  types: [TICKET_APPROVAL_REQUEST_TYPE, MINGO_APPROVAL_REQUEST_TYPE],
};

export interface ApprovalNotificationsPage {
  notifications: Notification[];
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
}

export async function fetchApprovalNotifications(after: string | undefined): Promise<ApprovalNotificationsPage> {
  const data = await fetchQuery<ApprovalNotificationsRelayQueryType>(
    getRelayEnvironment(),
    approvalNotificationsRelayQuery,
    { first: APPROVAL_NOTIFICATIONS_PAGE_SIZE, after, filter: APPROVAL_NOTIFICATIONS_FILTER },
    { fetchPolicy: 'network-only' },
  ).toPromise();
  const connection = data?.notifications;
  return {
    notifications: (connection?.edges ?? []).map(edge =>
      withNotificationIcon(mapNotificationNode(readNotificationNode(edge.node))),
    ),
    pageInfo: connection?.pageInfo ?? { hasNextPage: false },
  };
}
