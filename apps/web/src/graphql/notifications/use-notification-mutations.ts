'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useRelayEnvironment } from 'react-relay';
import type { deleteAllReadNotificationsMutation as DeleteAllReadNotificationsMutationType } from '@/__generated__/deleteAllReadNotificationsMutation.graphql';
import type { deleteNotificationMutation as DeleteNotificationMutationType } from '@/__generated__/deleteNotificationMutation.graphql';
import type { markAllNotificationsReadMutation as MarkAllReadMutationType } from '@/__generated__/markAllNotificationsReadMutation.graphql';
import type { markNotificationReadMutation as MarkReadMutationType } from '@/__generated__/markNotificationReadMutation.graphql';
import type { markNotificationsReadForEntityMutation as MarkEntityReadMutationType } from '@/__generated__/markNotificationsReadForEntityMutation.graphql';
import { deleteAllReadNotificationsMutation } from './delete-all-read-notifications-mutation';
import { deleteNotificationMutation } from './delete-notification-mutation';
import {
  clearEntityUnreadCounts,
  entityRefsOfEntity,
  entityRefsOfNotifications,
  refreshEntityUnreadCounts,
} from './entity-unread-counts';
import { markAllNotificationsReadMutation } from './mark-all-notifications-read-mutation';
import { markNotificationReadMutation } from './mark-notification-read-mutation';
import { markNotificationsReadForEntityMutation } from './mark-notifications-read-for-entity-mutation';
import {
  makeDeleteAllReadUpdater,
  makeDeleteNotificationUpdater,
  makeMarkAllReadUpdater,
  makeMarkEntityReadUpdater,
  makeMarkReadUpdater,
  type NotificationConnectionPair,
  type NotificationEntityScope,
} from './notifications-helpers';
import { refreshUnreadCounts } from './unread-counts-relay';

export type NotificationMutation = 'markRead' | 'markAllRead' | 'delete' | 'deleteAllRead';

interface UseNotificationMutationsOptions {
  filterPairs: NotificationConnectionPair[];
  onError?: (operation: NotificationMutation, err: Error) => void;
  onMarkAllReadCompleted?: () => void;
  onDeleteAllReadCompleted?: () => void;
}

export function useNotificationMutations({
  filterPairs,
  onError,
  onMarkAllReadCompleted,
  onDeleteAllReadCompleted,
}: UseNotificationMutationsOptions) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const [markReadCommit] = useMutation<MarkReadMutationType>(markNotificationReadMutation);
  const [markAllReadCommit, isMarkingAllRead] = useMutation<MarkAllReadMutationType>(markAllNotificationsReadMutation);
  const [deleteCommit] = useMutation<DeleteNotificationMutationType>(deleteNotificationMutation);
  const [deleteAllReadCommit, isDeletingAllRead] = useMutation<DeleteAllReadNotificationsMutationType>(
    deleteAllReadNotificationsMutation,
  );
  const [markEntityReadCommit, isMarkingEntityRead] = useMutation<MarkEntityReadMutationType>(
    markNotificationsReadForEntityMutation,
  );

  const filterPairsRef = useRef(filterPairs);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    filterPairsRef.current = filterPairs;
  });

  const commitMarkRead = useCallback(
    (id: string, reportFailure: (err: Error) => void) => {
      const updater = (store: Parameters<ReturnType<typeof makeMarkReadUpdater>>[0]) =>
        makeMarkReadUpdater(id, filterPairsRef.current)(store);
      const entityRefs = entityRefsOfNotifications(environment, [id]);
      markReadCommit({
        variables: { id },
        optimisticUpdater: updater,
        updater,
        onCompleted: () => {
          refreshUnreadCounts(environment);
          refreshEntityUnreadCounts(environment, entityRefs);
        },
        onError: err => {
          reportFailure(err);
          onError?.('markRead', err);
        },
      });
    },
    [environment, markReadCommit, onError],
  );

  const markRead = useCallback(
    (id: string) => {
      commitMarkRead(id, err => {
        toast({ title: 'Failed to mark as read', description: err.message, variant: 'destructive' });
      });
    },
    [commitMarkRead, toast],
  );

  /**
   * `markRead` for a read nobody asked for, so no toast: the user can do nothing about it, the row
   * just stays unread, and a route matching many rows would stack one toast per row.
   */
  const autoMarkRead = useCallback(
    (id: string) => {
      commitMarkRead(id, err => {
        console.warn('[Notifications] auto mark-read failed:', id, err);
      });
    },
    [commitMarkRead],
  );

  const markAllRead = useCallback(() => {
    const updater = (store: Parameters<ReturnType<typeof makeMarkAllReadUpdater>>[0]) =>
      makeMarkAllReadUpdater(filterPairsRef.current)(store);
    markAllReadCommit({
      variables: {},
      optimisticUpdater: updater,
      updater,
      onCompleted: () => {
        refreshUnreadCounts(environment);
        clearEntityUnreadCounts(environment);
        onMarkAllReadCompleted?.();
      },
      onError: err => {
        toast({ title: 'Failed to mark all as read', description: err.message, variant: 'destructive' });
        onError?.('markAllRead', err);
      },
    });
  }, [environment, markAllReadCommit, onError, onMarkAllReadCompleted, toast]);

  /** Mark All Complete where the list is one entity's: only that entity's notifications, loaded or not. */
  const markEntityRead = useCallback(
    (entity: NotificationEntityScope) => {
      const updater = (store: Parameters<ReturnType<typeof makeMarkEntityReadUpdater>>[0]) =>
        makeMarkEntityReadUpdater(entity, filterPairsRef.current)(store);
      markEntityReadCommit({
        variables: { entityType: entity.type, entityId: entity.id },
        optimisticUpdater: updater,
        updater,
        onCompleted: () => {
          refreshUnreadCounts(environment);
          refreshEntityUnreadCounts(environment, entityRefsOfEntity(entity.type, entity.id));
          onMarkAllReadCompleted?.();
        },
        onError: err => {
          toast({ title: 'Failed to mark all as read', description: err.message, variant: 'destructive' });
          onError?.('markAllRead', err);
        },
      });
    },
    [environment, markEntityReadCommit, onError, onMarkAllReadCompleted, toast],
  );

  const removeNotification = useCallback(
    (id: string) => {
      const updater = (store: Parameters<ReturnType<typeof makeDeleteNotificationUpdater>>[0]) =>
        makeDeleteNotificationUpdater(id, filterPairsRef.current)(store);
      const entityRefs = entityRefsOfNotifications(environment, [id]);
      deleteCommit({
        variables: { id },
        optimisticUpdater: updater,
        updater,
        onCompleted: () => {
          // Deleting an unread notification changes per-category counts, and its entity's.
          refreshUnreadCounts(environment);
          refreshEntityUnreadCounts(environment, entityRefs);
        },
        onError: err => {
          toast({ title: 'Failed to delete notification', description: err.message, variant: 'destructive' });
          onError?.('delete', err);
        },
      });
    },
    [deleteCommit, environment, onError, toast],
  );

  const removeAllRead = useCallback(() => {
    const updater = (store: Parameters<ReturnType<typeof makeDeleteAllReadUpdater>>[0]) =>
      makeDeleteAllReadUpdater(filterPairsRef.current)(store);
    deleteAllReadCommit({
      variables: {},
      optimisticUpdater: updater,
      updater,
      onCompleted: () => {
        onDeleteAllReadCompleted?.();
      },
      onError: err => {
        toast({ title: 'Failed to delete read notifications', description: err.message, variant: 'destructive' });
        onError?.('deleteAllRead', err);
      },
    });
  }, [deleteAllReadCommit, onError, onDeleteAllReadCompleted, toast]);

  return {
    markRead,
    autoMarkRead,
    markAllRead,
    markEntityRead,
    removeNotification,
    removeAllRead,
    isMarkingAllRead,
    isMarkingEntityRead,
    isDeletingAllRead,
  };
}
