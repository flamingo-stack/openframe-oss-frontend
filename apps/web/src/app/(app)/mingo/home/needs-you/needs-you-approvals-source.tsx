'use client';

import { useEffect, useMemo } from 'react';
import { useFragment, useLazyLoadQuery } from 'react-relay';
import type { notificationsDrawerRelay_query$key as NotificationsDrawerFragmentKey } from '@/__generated__/notificationsDrawerRelay_query.graphql';
import type { notificationsDrawerRelayQuery as NotificationsDrawerRelayQueryType } from '@/__generated__/notificationsDrawerRelayQuery.graphql';
import { useRetryKey } from '@/app/components/shared/content-error-boundary';
import {
  DRAWER_PAGE_SIZE,
  notificationsDrawerRelayFragment,
  notificationsDrawerRelayQuery,
} from '@/graphql/notifications/notifications-drawer-relay';
import { mapNotificationNode, readNotificationNode } from '@/graphql/notifications/notifications-helpers';
import { approvalRow, type NeedsYouRow, type ReportSource } from './needs-you-rows';

/**
 * Pending approval requests, read the way the notifications drawer reads them: the same
 * query and connection (the drawer's unread first page, kept live by its NATS bridge), so
 * this costs no request of its own once the drawer has loaded, and a decision made in the
 * drawer, the chat or the Needs approval page drops the row here too. An approval past the
 * drawer's first page is not seen (no `notifications(filter: { types })` yet).
 */
export function NeedsYouApprovalsSource({ onReport }: { onReport: ReportSource }) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<NotificationsDrawerRelayQueryType>(
    notificationsDrawerRelayQuery,
    { first: DRAWER_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );
  const data = useFragment<NotificationsDrawerFragmentKey>(notificationsDrawerRelayFragment, queryData);

  // Memoized for the effect below, which reports only when the rows actually change.
  const rows = useMemo(
    () =>
      data.notifications.edges.flatMap((edge): NeedsYouRow[] => {
        const row = approvalRow(mapNotificationNode(readNotificationNode(edge.node)));
        return row ? [row] : [];
      }),
    [data.notifications.edges],
  );

  useEffect(() => {
    onReport('approvals', { status: 'ready', rows });
  }, [onReport, rows]);

  return null;
}
