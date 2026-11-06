import { commitMutation, graphql } from 'react-relay';
import type { IEnvironment, RecordSourceSelectorProxy } from 'relay-runtime';
import type { markNotificationReadMutation as MarkReadMutationType } from '@/__generated__/markNotificationReadMutation.graphql';
import { notificationGlobalId } from '@/lib/relay-id';
import { getRelayEnvironment } from '@/lib/relay/environment';
import { entityRefsOfNotifications, refreshEntityUnreadCounts } from './entity-unread-counts';
import { getLiveConnectionPairs } from './live-connection-pairs';
import { makeMarkReadUpdater, type NotificationConnectionPair } from './notifications-helpers';
import { refreshUnreadCounts } from './unread-counts-relay';

export const markNotificationReadMutation = graphql`
  mutation markNotificationReadMutation($id: ID!) {
    markNotificationAsRead(notificationId: $id)
  }
`;

/**
 * Mark one notification read: at once in the lists `pairs` names (read when the store
 * update runs, so a list mounted meanwhile is reached too), then the unread counts re-read,
 * its entity's included. The way a read the user caused is committed: a click, a shell's
 * tap, arriving at its entity. The live bridge's reads on arrival commit the bare mutation
 * instead (`notifications-data-provider.tsx`), since the arrival's own update already holds
 * the read.
 */
export function commitMarkNotificationRead(
  environment: IEnvironment,
  id: string,
  { pairs, onError }: { pairs: () => NotificationConnectionPair[]; onError: (error: Error) => void },
): void {
  const updater = (store: RecordSourceSelectorProxy) => makeMarkReadUpdater(id, pairs())(store);
  const entityRefs = entityRefsOfNotifications(environment, [id]);
  commitMutation<MarkReadMutationType>(environment, {
    mutation: markNotificationReadMutation,
    variables: { id },
    optimisticUpdater: updater,
    updater,
    onCompleted: () => {
      refreshUnreadCounts(environment);
      refreshEntityUnreadCounts(environment, entityRefs);
    },
    onError,
  });
}

/**
 * Mark read, from outside React, the notification a shell's tap opened, by its stored id:
 * into every live list (`getLiveConnectionPairs`), the drawer's and any mounted page's. A
 * failure is only logged, as an automatic read's is: the tap has already opened what the
 * user asked for.
 */
export function markNotificationReadById(rawId: string): void {
  commitMarkNotificationRead(getRelayEnvironment(), notificationGlobalId(rawId), {
    pairs: getLiveConnectionPairs,
    onError: error => console.warn('[Notifications] mark-read on a shell tap failed:', rawId, error),
  });
}
